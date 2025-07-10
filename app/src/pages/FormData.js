import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  const activeLang = UIState.useState((s) => s.lang);
  const trans = i18n.text(activeLang);
  const { id: activeUserId } = UserState.useState((s) => s);
  const [search, setSearch] = useState(null);
  const [data, setData] = useState([]);
  const db = useSQLiteContext();

  const fetchData = useCallback(async () => {
    let results = await crudDataPoints.selectDataPointsByFormAndSubmitted(db, {
      form: formId,
      submitted: 0,
      user: activeUserId,
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
  }, [
    db,
    showSubmitted,
    activeUserId,
    formId,
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
      <BaseLayout.Content data={filteredData} action={handleOnAction} testID="data-point-list" />
    </BaseLayout>
  );
};

export default FormDataPage;
