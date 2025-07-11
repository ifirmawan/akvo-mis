import { crudDataPoints, crudForms } from '../database/crud';
import { DatapointSyncState } from '../store';
import api from './api';

export const fetchDatapoints = async (pageNumber = 1) => {
  try {
    const { data: apiData } = await api.get(`/datapoint-list?page=${pageNumber}`);
    const { data, total_page: totalPage, current: page } = apiData;
    DatapointSyncState.update((s) => {
      s.progress = (page / totalPage) * 100;
    });
    if (page < totalPage) {
      return data.concat(await fetchDatapoints(page + 1));
    }
    return data;
  } catch (error) {
    return Promise.reject(error);
  }
};

export const fetchDraftDatapoints = async (pageNumber = 1) => {
  try {
    const { data: apiData } = await api.get(`/draft-list?page=${pageNumber}`);
    const { data, total_page: totalPage, current: page } = apiData;
    DatapointSyncState.update((s) => {
      s.progress = (page / totalPage) * 100;
    });
    if (page < totalPage) {
      return data.concat(await fetchDraftDatapoints(page + 1));
    }
    return data;
  } catch (error) {
    return Promise.reject(error);
  }
};

export const downloadDatapointsJson = async (
  db,
  { formId, administrationId, url, lastUpdated },
  user,
) => {
  try {
    const response = await api.get(url);
    if (response.status === 200) {
      const jsonData = response.data;
      const { uuid, datapoint_name: name, geolocation: geo, answers, id: dpID } = jsonData || {};
      const form = await crudForms.getByFormId(db, { formId });
      const repeats = {};
      let repeatIndex = 0;
      JSON.parse(form?.json || '{}')?.question_group?.forEach((group) => {
        if (group.repeatable) {
          const qIDs = group.question.map((q) => `${q.id}`);
          const maxRepeats = Object.keys(answers)
            .filter((k) => k?.includes('-'))
            .filter((k) => {
              const [qId] = k.split('-');
              return qIDs.includes(qId);
            })
            .reduce((acc, key) => {
              const match = key.match(/-(\d+)$/);
              if (match) {
                const num = parseInt(match[1], 10);
                return Math.max(acc, num);
              }
              return acc;
            }, 0);
          repeats[repeatIndex] = Array.from({ length: maxRepeats + 1 }, (_, i) => i);
          repeatIndex += 1;
        }
      });
      const isExists = await crudDataPoints.getByUUID(db, { uuid });
      if (isExists) {
        await crudDataPoints.updateByUUID(db, {
          uuid,
          json: answers,
          syncedAt: lastUpdated,
          repeats: JSON.stringify(repeats),
        });
      } else {
        await crudDataPoints.deleteById(db, { id: dpID });
        await crudDataPoints.saveDataPoint(db, {
          uuid,
          user,
          geo,
          name,
          administrationId,
          form: form?.id,
          submitted: 1,
          duration: 0,
          createdAt: new Date().toISOString(),
          json: answers,
          syncedAt: lastUpdated,
          repeats: JSON.stringify(repeats),
          id: dpID || null,
        });
      }
    }
  } catch (error) {
    Promise.reject(error);
  }
};
