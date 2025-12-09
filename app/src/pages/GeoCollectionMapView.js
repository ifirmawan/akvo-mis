import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as Location from 'expo-location';
import { Button, Text, Dialog, Input } from '@rneui/themed';
import { FormState, UIState, BuildParamsState } from '../store';
import { i18n } from '../lib';

const GeoCollectionMapView = ({ navigation, route }) => {
  const {
    id: questionID,
    questionType, // 'geotrace' or 'geoshape'
    inputMethod, // 'manual', 'automatic', 'tapping'
    existingPoints = [],
  } = route.params;

  const [htmlContent, setHtmlContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState(existingPoints || []);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [recordingInterval, setRecordingInterval] = useState('5');
  const [accuracyRequirement, setAccuracyRequirement] = useState('10');

  const webViewRef = useRef(null);
  const locationSubscription = useRef(null);
  const recordingTimer = useRef(null);

  const selectedForm = FormState.useState((s) => s.form);
  const activeLang = UIState.useState((s) => s.lang);
  const gpsThreshold = BuildParamsState.useState((s) => s.gpsThreshold);
  const trans = i18n.text(activeLang);

  const minPoints = questionType === 'geoshape' ? 3 : 2;

  const loadHtml = useCallback(async () => {
    try {
      // eslint-disable-next-line global-require
      const [{ localUri }] = await Asset.loadAsync(require('../../assets/map-collection.html'));
      const fileContents = await FileSystem.readAsStringAsync(localUri);

      const safePoints = existingPoints || [];
      const centerLat =
        safePoints.length > 0 ? safePoints[0][0] : currentLocation?.coords?.latitude || -6.1754;
      const centerLng =
        safePoints.length > 0 ? safePoints[0][1] : currentLocation?.coords?.longitude || 106.8272;

      const htmlContents = fileContents
        .replace(/{{mode}}/g, questionType || 'geotrace')
        .replace(/{{points}}/g, JSON.stringify(safePoints))
        .replace(/{{centerLat}}/g, String(centerLat))
        .replace(/{{centerLng}}/g, String(centerLng));

      setHtmlContent(htmlContents);
      setLoading(false);
    } catch (error) {
      console.error('Error loading map HTML:', error);
      setLoading(false);
    }
  }, [questionType, existingPoints, currentLocation]);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  };

  const getCurrentPosition = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation(location);
      setGpsAccuracy(Math.floor(location.coords.accuracy));
      return location;
    } catch (error) {
      console.error('Error getting location:', error);
      return null;
    }
  };

  const addPoint = useCallback((lat, lng, accuracy = null) => {
    const newPoint = [lat, lng];
    setPoints((prevPoints) => {
      const updated = [...prevPoints, newPoint];

      // Send to WebView
      if (webViewRef.current) {
        webViewRef.current.postMessage(
          JSON.stringify({
            type: 'updatePoints',
            data: { points: updated },
          }),
        );
      }

      return updated;
    });

    if (accuracy) {
      setGpsAccuracy(Math.floor(accuracy));
    }
  }, []);

  const handleManualRecord = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      alert('Location permission is required');
      return;
    }

    const location = await getCurrentPosition();
    if (location) {
      const { latitude, longitude, accuracy } = location.coords;
      addPoint(latitude, longitude, accuracy);
    }
  };

  const startAutomaticRecording = useCallback(async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      alert('Location permission is required');
      return;
    }

    setShowConfigDialog(false);
    setIsRecording(true);
    setIsPaused(false);

    const interval = parseInt(recordingInterval, 10) * 1000;
    const requiredAccuracy = parseFloat(accuracyRequirement);

    // Watch position with continuous updates
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 0,
      },
      (location) => {
        setCurrentLocation(location);
        const accuracy = Math.floor(location.coords.accuracy);
        setGpsAccuracy(accuracy);
      },
    );

    // Record points at intervals
    recordingTimer.current = setInterval(() => {
      if (currentLocation && !isPaused) {
        const accuracy = Math.floor(currentLocation.coords.accuracy);
        if (accuracy <= requiredAccuracy) {
          const { latitude, longitude } = currentLocation.coords;
          addPoint(latitude, longitude, accuracy);
        }
      }
    }, interval);
  }, [recordingInterval, accuracyRequirement, currentLocation, isPaused, addPoint]);

  const stopAutomaticRecording = useCallback(() => {
    setIsRecording(false);
    setIsPaused(false);

    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }

    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }
  }, []);

  const handleMapClick = useCallback(
    (lat, lng) => {
      addPoint(lat, lng);
    },
    [addPoint],
  );

  const handleDeleteLastPoint = () => {
    setPoints((prevPoints) => {
      const updated = prevPoints.slice(0, -1);

      if (webViewRef.current) {
        webViewRef.current.postMessage(
          JSON.stringify({
            type: 'updatePoints',
            data: { points: updated },
          }),
        );
      }

      return updated;
    });
  };

  const handleClearAll = () => {
    setPoints([]);

    if (webViewRef.current) {
      webViewRef.current.postMessage(
        JSON.stringify({
          type: 'clearPoints',
          data: {},
        }),
      );
    }
  };

  const handleSave = () => {
    if (points.length < minPoints) {
      const message =
        questionType === 'geoshape'
          ? trans.geoCollectionMinPointsGeoshape
          : trans.geoCollectionMinPointsGeotrace;
      alert(message);
      return;
    }

    // Update FormState with the collected points
    FormState.update((s) => {
      s.currentValues = {
        ...s.currentValues,
        [questionID]: points,
      };
    });

    // Navigate back to form
    navigation.navigate('FormPage', {
      id: selectedForm?.id,
      name: selectedForm?.name,
    });
  };

  const handleCancel = () => {
    if (isRecording) {
      stopAutomaticRecording();
    }
    navigation.goBack();
  };

  useEffect(() => {
    const initialize = async () => {
      await getCurrentPosition();
      await loadHtml();
    };
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Show config dialog for automatic recording
    if (inputMethod === 'automatic') {
      setShowConfigDialog(true);
    }
  }, [inputMethod]);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
    };
  }, []);

  const getAccuracyColor = () => {
    if (!gpsAccuracy) return 'gray';
    const required = parseFloat(accuracyRequirement);
    if (gpsAccuracy < 10) return 'green';
    if (gpsAccuracy < required) return 'orange';
    return 'red';
  };

  const accuracyOptions = [
    { label: '5m', value: '5' },
    { label: '10m', value: '10' },
    { label: '15m', value: '15' },
    { label: '20m', value: '20' },
  ];

  return (
    <View style={styles.container}>
      {(loading || !htmlContent) && <ActivityIndicator />}

      <View style={styles.map}>
        {htmlContent && (
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: htmlContent }}
            onMessage={(event) => {
              const messageData = JSON.parse(event.nativeEvent.data);
              if (messageData.type === 'mapClicked' && inputMethod === 'tapping') {
                const { lat, lng } = messageData.data;
                handleMapClick(lat, lng);
              }
            }}
            testID="webview-map-collection"
          />
        )}
      </View>

      <ScrollView style={styles.controlContainer}>
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            {trans.geoCollectionPointCount}: {points.length}
            {points.length >= minPoints ? ' ✓' : ` (min ${minPoints})`}
          </Text>

          {gpsAccuracy && (
            <Text style={styles.infoText}>
              {trans.geoCollectionGPSAccuracy}:
              <Text style={{ color: getAccuracyColor() }}> {gpsAccuracy}m</Text>
            </Text>
          )}

          {isRecording && (
            <Text style={[styles.infoText, { color: 'red' }]}>
              {isPaused ? trans.geoCollectionPause : trans.geoCollectionRecording}
            </Text>
          )}
        </View>

        <View style={styles.buttonContainer}>
          {inputMethod === 'manual' && (
            <Button
              onPress={handleManualRecord}
              testID="button-record-point"
              buttonStyle={styles.button}
              title={trans.geoCollectionRecordPoint}
            />
          )}

          {inputMethod === 'automatic' && (
            <>
              {!isRecording ? (
                <Button
                  onPress={() => setShowConfigDialog(true)}
                  testID="button-start-recording"
                  buttonStyle={styles.button}
                  title={trans.geoCollectionStartRecording}
                />
              ) : (
                <>
                  <Button
                    onPress={() => setIsPaused(!isPaused)}
                    testID="button-pause-resume"
                    buttonStyle={styles.button}
                    title={isPaused ? trans.geoCollectionResume : trans.geoCollectionPause}
                  />
                  <Button
                    onPress={stopAutomaticRecording}
                    testID="button-stop-recording"
                    buttonStyle={styles.button}
                    color="error"
                    title={trans.geoCollectionStopRecording}
                  />
                </>
              )}
            </>
          )}

          <View style={styles.buttonRow}>
            <Button
              onPress={handleDeleteLastPoint}
              testID="button-delete-last"
              buttonStyle={[styles.button]}
              disabled={points.length === 0}
              title={trans.geoCollectionDeleteLastPoint}
            />
            <Button
              onPress={handleClearAll}
              testID="button-clear-all"
              buttonStyle={[styles.button, styles.smallButton]}
              disabled={points.length === 0}
              color="warning"
              title={trans.geoCollectionClear}
            />
          </View>

          <View style={styles.buttonRow}>
            <Button
              onPress={handleSave}
              testID="button-save"
              buttonStyle={[styles.button, styles.saveButton]}
              disabled={points.length < minPoints}
              title={trans.geoCollectionSave}
            />
            <Button
              onPress={handleCancel}
              testID="button-cancel"
              type="outline"
              buttonStyle={[styles.button, styles.cancelButton]}
              title={trans.buttonCancel}
            />
          </View>
        </View>
      </ScrollView>

      {/* Configuration Dialog for Automatic Recording */}
      <Dialog
        isVisible={showConfigDialog}
        onBackdropPress={() => !isRecording && setShowConfigDialog(false)}
      >
        <Dialog.Title title={trans.geoCollectionAutomaticRecording} />

        <Text style={styles.dialogLabel}>{trans.geoCollectionInterval}:</Text>
        <Input
          value={recordingInterval}
          onChangeText={setRecordingInterval}
          keyboardType="numeric"
          placeholder="5"
          rightIcon={<Text>{trans.geoCollectionSeconds}</Text>}
          testID="input-interval"
        />

        <Text style={styles.dialogLabel}>{trans.geoCollectionAccuracy}:</Text>
        <View style={styles.accuracyButtons}>
          {accuracyOptions.map((option) => (
            <Button
              key={option.value}
              title={option.label}
              onPress={() => setAccuracyRequirement(option.value)}
              type={accuracyRequirement === option.value ? 'solid' : 'outline'}
              containerStyle={styles.accuracyButton}
              testID={`button-accuracy-${option.value}`}
            />
          ))}
        </View>
        <Button
          title={trans.geoCollectionStartRecording}
          onPress={startAutomaticRecording}
          testID="button-confirm-config"
          containerStyle={{ marginTop: 10 }}
        />
        {!isRecording && (
          <Button
            title={trans.buttonCancel}
            onPress={() => setShowConfigDialog(false)}
            type="outline"
            testID="button-cancel-config"
            containerStyle={{ marginTop: 10 }}
          />
        )}
      </Dialog>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  controlContainer: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    maxHeight: '30%',
  },
  infoContainer: {
    padding: 10,
    maxHeight: 80,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 5,
  },
  buttonContainer: {
    padding: 10,
    gap: 4,
  },
  button: {
    marginVertical: 4,
    minHeight: 32,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },
  cancelButton: {
    flex: 1,
  },
  dialogLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  accuracyButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 10,
  },
  accuracyButton: {
    flex: 0,
    minWidth: 60,
  },
});

export default GeoCollectionMapView;
