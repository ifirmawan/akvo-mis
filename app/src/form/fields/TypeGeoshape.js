import React, { useState } from 'react';
import { View } from 'react-native';
import { Text, Button, Dialog } from '@rneui/themed';
import { useNavigation } from '@react-navigation/native';

import { FormState } from '../../store';
import { FieldLabel } from '../support';
import styles from '../styles';
import { i18n } from '../../lib';

const TypeGeoshape = ({
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

  const calculateAreaAndPerimeter = (coordinates) => {
    if (!coordinates || coordinates.length < 3) return { area: 0, perimeter: 0 };

    // Calculate perimeter
    let perimeter = 0;
    const R = 6371e3; // Earth's radius in meters

    for (let i = 0; i < coordinates.length; i++) {
      const [lat1, lon1] = coordinates[i];
      const [lat2, lon2] = coordinates[(i + 1) % coordinates.length];

      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      perimeter += R * c;
    }

    // Calculate area using the Shoelace formula (planar approximation)
    let area = 0;
    for (let i = 0; i < coordinates.length; i++) {
      const [lat1, lon1] = coordinates[i];
      const [lat2, lon2] = coordinates[(i + 1) % coordinates.length];
      area += lon1 * lat2 - lon2 * lat1;
    }
    area = Math.abs(area / 2);

    // Convert to square meters (rough approximation)
    const latAvg = coordinates.reduce((sum, [lat]) => sum + lat, 0) / coordinates.length;
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLon = 111320 * Math.cos((latAvg * Math.PI) / 180);
    area = area * metersPerDegreeLat * metersPerDegreeLon;

    return { area, perimeter };
  };

  const { area, perimeter } = calculateAreaAndPerimeter(points);
  const areaHectares = (area / 10000).toFixed(2);
  const perimeterKm = (perimeter / 1000).toFixed(2);

  const handleInputMethodSelect = (method) => {
    setShowInputMethodDialog(false);
    navigation.navigate('GeoCollectionMapView', {
      id,
      questionType: 'geoshape',
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
            <Text testID="text-area">
              {trans.geoCollectionArea}: {areaHectares} ha
            </Text>
            <Text testID="text-perimeter">
              {trans.geoCollectionPerimeter}: {perimeterKm} km
            </Text>
          </View>
        ) : (
          <Text testID="text-no-data">{trans.geoCollectionMinPointsGeoshape}</Text>
        )}

        <View style={styles.geoButtonGroup}>
          <Button onPress={handleOpenMapView} testID="button-open-geoshape" disabled={disabled}>
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

export default TypeGeoshape;
