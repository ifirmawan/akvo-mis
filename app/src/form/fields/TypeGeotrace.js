import React, { useState } from 'react';
import { View } from 'react-native';
import { Text, Button, Dialog } from '@rneui/themed';
import { useNavigation } from '@react-navigation/native';

import { FormState } from '../../store';
import { FieldLabel } from '../support';
import styles from '../styles';
import { i18n } from '../../lib';

const TypeGeotrace = ({
  keyform,
  id,
  label,
  value = null,
  tooltip = null,
  required,
  requiredSign = '*',
  disabled = false,
}) => {
  const navigation = useNavigation();
  const [showInputMethodDialog, setShowInputMethodDialog] = useState(false);

  const activeLang = FormState.useState((s) => s.lang);
  const trans = i18n.text(activeLang);
  const requiredValue = required ? requiredSign : null;

  const points = value || [];
  const pointCount = points.length;

  const calculateDistance = (coordinates) => {
    if (!coordinates || coordinates.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const [lat1, lon1] = coordinates[i];
      const [lat2, lon2] = coordinates[i + 1];

      // Haversine formula for distance calculation
      const R = 6371e3; // Earth's radius in meters
      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      totalDistance += R * c;
    }

    return totalDistance;
  };

  const distance = calculateDistance(points);
  const distanceKm = (distance / 1000).toFixed(2);

  const handleInputMethodSelect = (method) => {
    setShowInputMethodDialog(false);
    navigation.navigate('GeoCollectionMapView', {
      id,
      questionType: 'geotrace',
      inputMethod: method,
      existingPoints: points,
    });
  };

  const handleOpenMapView = () => {
    if (disabled) return;
    setShowInputMethodDialog(true);
  };

  return (
    <View>
      <FieldLabel keyform={keyform} name={label} tooltip={tooltip} requiredSign={requiredValue} />
      <View style={styles.inputGeoContainer}>
        {pointCount > 0 ? (
          <View>
            <Text testID="text-point-count">
              {trans.geoCollectionPointCount}: {pointCount}
            </Text>
            <Text testID="text-distance">
              {trans.geoCollectionDistance}: {distanceKm} km
            </Text>
          </View>
        ) : (
          <Text testID="text-no-data">{trans.geoCollectionMinPointsGeotrace}</Text>
        )}

        <View style={styles.geoButtonGroup}>
          <Button onPress={handleOpenMapView} testID="button-open-geotrace" disabled={disabled}>
            {pointCount > 0 ? trans.geoCollectionEdit : trans.geoCollectionViewOnMap}
          </Button>
        </View>
      </View>

      <Dialog
        isVisible={showInputMethodDialog}
        onBackdropPress={() => setShowInputMethodDialog(false)}
      >
        <Dialog.Title title={trans.geoCollectionInputMethod} />
        <Button
          title={trans.geoCollectionManualRecording}
          onPress={() => handleInputMethodSelect('manual')}
          testID="button-input-manual"
          containerStyle={{ marginBottom: 10 }}
        />
        <Button
          title={trans.geoCollectionAutomaticRecording}
          onPress={() => handleInputMethodSelect('automatic')}
          testID="button-input-automatic"
          containerStyle={{ marginBottom: 10 }}
        />
        <Button
          title={trans.geoCollectionPlacementByTapping}
          onPress={() => handleInputMethodSelect('tapping')}
          testID="button-input-tapping"
          containerStyle={{ marginBottom: 10 }}
        />
        <Button
          title={trans.buttonCancel}
          onPress={() => setShowInputMethodDialog(false)}
          type="outline"
          testID="button-cancel"
        />
      </Dialog>
    </View>
  );
};

export default TypeGeotrace;
