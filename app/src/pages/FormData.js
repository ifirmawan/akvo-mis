import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FlatList, TouchableOpacity, View, Text, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import moment from 'moment';
import { useSQLiteContext } from 'expo-sqlite';
import { UserState, UIState, FormState } from '../store';
import { BaseLayout } from '../components';
import { crudDataPoints } from '../database/crud';
import { i18n } from '../lib';
import { getCurrentTimestamp } from '../form/lib';

const convertMinutesToHHMM = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);

  const formattedHours = String(hours).padStart(2, '0');
  const formattedMinutes = String(remainingMinutes).padStart(2, '0');

  return `${formattedHours}h ${formattedMinutes}m`;
};

const FormDataPage = ({ navigation, route }) => {
  const formId = route?.params?.id;
  const showSubmitted = route?.params?.showSubmitted || false;
  const uuid = route?.params?.uuid || null;
  const activeLang = UIState.useState((s) => s.lang);
  const trans = i18n.text(activeLang);
  const { id: activeUserId } = UserState.useState((s) => s);
  const [search, setSearch] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const db = useSQLiteContext();

  const fetchData = useCallback(async () => {
    let results = await crudDataPoints.selectDataPointsByFormAndSubmitted(db, {
      form: formId,
      submitted: 0,
      user: activeUserId,
      uuid,
    });
    results = results.map((res) => {
      const createdAt = moment(res.createdAt).format('DD/MM/YYYY hh:mm A');
      const syncedAt = res.syncedAt ? moment(res.syncedAt).format('DD/MM/YYYY hh:mm A') : '-';
      let subtitlesTemp = [
        `${trans.createdLabel}${createdAt}`,
        `${trans.surveyDurationLabel}${convertMinutesToHHMM(res.duration)}`,
      ];
      if (showSubmitted) {
        subtitlesTemp = [...subtitlesTemp, `${trans.syncLabel}${syncedAt}`];
      }
      return {
        ...res,
        subtitles: subtitlesTemp,
      };
    });
    setData(results);
    if (results.length === 0) {
      setLoading(false);
      return;
    }
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, [
    db,
    showSubmitted,
    activeUserId,
    formId,
    uuid,
    trans.createdLabel,
    trans.surveyDurationLabel,
    trans.syncLabel,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredData = useMemo(
    () =>
      data.filter(
        (d) => (search && d?.name?.toLowerCase().includes(search.toLowerCase())) || !search,
      ),
    [data, search],
  );

  const goToDetails = (id) => {
    const findData = filteredData.find((d) => d.id === id);
    const { json: valuesJSON, name: dataPointName } = findData || {};

    FormState.update((s) => {
      const valuesParsed = JSON.parse(valuesJSON);
      s.currentValues = typeof valuesParsed === 'string' ? JSON.parse(valuesParsed) : valuesParsed;
    });

    navigation.navigate('FormDataDetails', { name: dataPointName });
  };

  const goToEditForm = (id) => {
    const selectedData = filteredData.find((d) => d.id === id);
    FormState.update((s) => {
      s.surveyStart = getCurrentTimestamp();
      s.surveyDuration = selectedData?.duration;
      s.repeats = selectedData?.repeats ? JSON.parse(selectedData?.repeats) : {};
    });
    navigation.navigate('FormPage', {
      ...route?.params,
      dataPointId: id,
      newSubmission: false,
    });
  };

  const handleOnAction = showSubmitted ? goToDetails : goToEditForm;

  const renderItem = ({ item }) => (
    <TouchableOpacity
      key={item.id}
      onPress={() => handleOnAction(item.id)}
      testID={`data-point-item-${item.id}`}
      style={{
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: 'white',
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
      }}
      activeOpacity={0.6}
    >
      <View
        style={{
          width: 40,
          height: 40,
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: 20,
          backgroundColor: '#f5f5f5',
          marginRight: 12,
        }}
      >
        <Icon
          name={item.syncedAt && item.syncedAt !== '-' ? 'checkmark' : 'time'}
          size={24}
          color={item.syncedAt && item.syncedAt !== '-' ? '#4CAF50' : '#FFA000'}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#212121', marginBottom: 4 }}>
          {item.name}
        </Text>
        {item.subtitles?.map((subtitle) => (
          <Text key={subtitle} style={{ fontSize: 12, color: '#9e9e9e' }}>
            {subtitle}
          </Text>
        ))}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () =>
    loading ? (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 40,
          paddingVertical: 60,
        }}
      >
        <View style={{ marginBottom: 20 }}>
          <ActivityIndicator size="large" color="#6200EE" />
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: '#757575', textAlign: 'center', lineHeight: 20 }}>
            {trans.fetchingData}
          </Text>
        </View>
      </View>
    ) : (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 40,
          paddingVertical: 60,
        }}
      >
        <View style={{ marginBottom: 20 }}>
          <Icon name="folder-outline" size={64} color="#C5CAE9" />
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: 'bold',
              color: '#424242',
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            {trans.emptyDraftMessageInfo}
          </Text>
          <Text style={{ fontSize: 14, color: '#757575', textAlign: 'center', lineHeight: 20 }}>
            {trans.emptyDraftMessageAction}
          </Text>
        </View>
      </View>
    );

  return (
    <BaseLayout
      title={trans.manageEditSavedForm}
      subTitle={route?.params?.name}
      search={{
        show: true,
        placeholder: trans.formDataSearch,
        value: search,
        action: setSearch,
      }}
    >
      <BaseLayout.Content>
        <View style={{ flex: 1, width: '100%' }}>
          <FlatList
            data={filteredData}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            testID="data-point-list"
            contentContainerStyle={[{ padding: 8 }, filteredData.length === 0 && { flexGrow: 1 }]}
            ListEmptyComponent={renderEmptyState}
          />
        </View>
      </BaseLayout.Content>
    </BaseLayout>
  );
};

export default FormDataPage;
