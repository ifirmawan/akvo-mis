import { useCallback, useEffect } from 'react';
import * as Network from 'expo-network';
import { useSQLiteContext } from 'expo-sqlite';
import { BuildParamsState, DatapointSyncState, UIState, UserState } from '../store';
import { backgroundTask } from '../lib';
import crudJobs from '../database/crud/crud-jobs';
import { crudConfig, crudDataPoints, crudForms } from '../database/crud';
import {
  downloadDatapointsJson,
  fetchDatapoints,
  fetchDraftDatapoints,
} from '../lib/sync-datapoints';
import {
  jobStatus,
  MAX_ATTEMPT,
  SYNC_DATAPOINT_JOB_NAME,
  SYNC_FORM_SUBMISSION_TASK_NAME,
  SYNC_STATUS,
} from '../lib/constants';
/**
 * This sync only works in the foreground service
 */
const SyncService = () => {
  const isOnline = UIState.useState((s) => s.online);
  const isManualSynced = UIState.useState((s) => s.isManualSynced);
  const syncInterval = BuildParamsState.useState((s) => s.dataSyncInterval);
  const syncInSecond = parseInt(syncInterval, 10) * 1000;
  const userId = UserState.useState((s) => s.id);
  const db = useSQLiteContext();

  const onSync = useCallback(async () => {
    const pendingToSync = await crudDataPoints.selectSubmissionToSync(db);
    const activeJob = await crudJobs.getActiveJob(db, SYNC_FORM_SUBMISSION_TASK_NAME);
    const settings = await crudConfig.getConfig(db);

    const { type: networkType } = await Network.getNetworkStateAsync();
    if (settings?.syncWifiOnly && networkType !== Network.NetworkStateType.WIFI) {
      return;
    }

    if (activeJob?.status === jobStatus.ON_PROGRESS) {
      if (activeJob.attempt < MAX_ATTEMPT) {
        /**
         * Job is still in progress,
         * but we still have pending items; then increase the attempt value.
         */
        await crudJobs.updateJob(db, activeJob.id, {
          attempt: activeJob.attempt + 1,
        });
      }

      if (activeJob.attempt === MAX_ATTEMPT) {
        /**
         * If the status is still IN PROGRESS and has reached the maximum attempts,
         * set it to PENDING when there are still pending sync items,
         * delete the job when it's finish and there are no pending items.
         */
        if (pendingToSync) {
          UIState.update((s) => {
            s.statusBar = {
              type: SYNC_STATUS.re_sync,
              bgColor: '#d97706',
              icon: 'repeat',
            };
          });
          await crudJobs.updateJob(db, activeJob.id, {
            status: jobStatus.PENDING,
            attempt: 0, // RESET attempt to 0
          });
        } else {
          UIState.update((s) => {
            s.statusBar = {
              type: SYNC_STATUS.success,
              bgColor: '#16a34a',
              icon: 'checkmark-done',
            };
            s.refreshPage = true;
          });
          await crudJobs.deleteJob(db, activeJob.id);
        }
      }
    }

    if (
      activeJob?.status === jobStatus.PENDING ||
      (activeJob?.status === jobStatus.FAILED && activeJob?.attempt <= MAX_ATTEMPT)
    ) {
      UIState.update((s) => {
        s.statusBar = {
          type: SYNC_STATUS.on_progress,
          bgColor: '#2563eb',
          icon: 'sync',
        };
      });
      await crudJobs.updateJob(db, activeJob.id, {
        status: jobStatus.ON_PROGRESS,
      });
      await backgroundTask.syncFormSubmission(db, activeJob);
    }
  }, [db]);

  useEffect(() => {
    if (!syncInSecond || !isOnline) {
      return;
    }
    const syncTimer = setInterval(() => {
      // Perform sync operation
      onSync();
    }, syncInSecond);

    // eslint-disable-next-line consistent-return
    return () =>
      // Clear the interval when the component unmounts
      clearInterval(syncTimer);
  }, [syncInSecond, isOnline, isManualSynced, onSync]);

  const onSyncDataPoint = useCallback(async () => {
    const activeJob = await crudJobs.getActiveJob(db, SYNC_DATAPOINT_JOB_NAME);

    DatapointSyncState.update((s) => {
      s.added = false;
      s.inProgress = !!activeJob;
    });

    if (activeJob && activeJob.status === jobStatus.PENDING && activeJob.attempt < MAX_ATTEMPT) {
      await crudJobs.updateJob(db, activeJob.id, {
        status: jobStatus.ON_PROGRESS,
      });

      try {
        const monitoringRes = await fetchDatapoints();
        const apiURLs = monitoringRes.map(
          ({
            url,
            form_id: formId,
            administration_id: administrationId,
            last_updated: lastUpdated,
          }) => ({
            url,
            formId,
            administrationId,
            lastUpdated,
          }),
        );

        await Promise.all(apiURLs.map((u) => downloadDatapointsJson(db, u, activeJob.user)));
        await crudJobs.deleteJob(db, activeJob.id);

        DatapointSyncState.update((s) => {
          s.inProgress = false;
        });

        UIState.update((s) => {
          s.refreshPage = true;
        });
      } catch (error) {
        DatapointSyncState.update((s) => {
          s.added = true;
        });
        await crudJobs.updateJob(db, activeJob.id, {
          status: jobStatus.PENDING,
          attempt: activeJob.attempt + 1,
          info: String(error),
        });
      }
    }

    if (activeJob && activeJob.status === jobStatus.PENDING && activeJob.attempt === MAX_ATTEMPT) {
      await crudJobs.deleteJob(db, activeJob.id);
      DatapointSyncState.update((s) => {
        s.inProgress = false;
      });
    }
  }, [db]);

  const onSyncDraftDatapoint = useCallback(async () => {
    const allDraftSynced = await crudDataPoints.getDraftPendingSync(db);
    if (allDraftSynced?.length || (allDraftSynced?.length === 0 && isManualSynced)) {
      try {
        await crudDataPoints.deleteDraftSynced(db);
        const draftRes = await fetchDraftDatapoints();
        draftRes.forEach(
          async ({
            administration: administrationId,
            datapoint_name: name,
            geolocation: geo,
            form: formId,
            repeats,
            ...d
          }) => {
            const isExists = await crudDataPoints.getByDraftId(db, { draftId: d.id });
            if (isExists && isExists?.syncedAt) {
              // If the draft already exists, update it
              await crudDataPoints.updateDataPoint(db, {
                ...d,
                name,
                geo,
                repeats: JSON.stringify(repeats),
                submitted: 0,
                syncedAt: new Date().toISOString(),
              });
            }
            if (!isExists && d?.id && name?.trim()?.length) {
              // If the draft does not exist, create a new one
              const form = await crudForms.getByFormId(db, { formId });
              await crudDataPoints.saveDataPoint(db, {
                ...d,
                administrationId,
                name,
                geo,
                repeats: JSON.stringify(repeats),
                form: form.id,
                submitted: 0,
                user: userId,
                draftId: d.id,
                createdAt: new Date().toISOString(),
                syncedAt: new Date().toISOString(),
              });
            }
          },
        );

        await crudDataPoints.deleteDraftIdIsNull(db);

        DatapointSyncState.update((s) => {
          s.inProgress = false;
        });

        UIState.update((s) => {
          s.refreshPage = true;
        });
      } catch (error) {
        UIState.update((s) => {
          s.statusBar = {
            type: SYNC_STATUS.failed,
            bgColor: '#ec003f',
            icon: 'alert',
            error: String(error),
          };
        });
      }
    }
  }, [db, userId, isManualSynced]);

  useEffect(() => {
    const unsubsDataSync = DatapointSyncState.subscribe(
      (s) => s.added,
      (added) => {
        if (added) {
          onSyncDataPoint();
          onSyncDraftDatapoint();
        }
      },
    );

    return () => {
      unsubsDataSync();
    };
  }, [onSyncDataPoint, onSyncDraftDatapoint]);

  useEffect(() => {
    if (isManualSynced) {
      // If manual sync is triggered, run the sync immediately
      onSync();
    }
  }, [isManualSynced, onSync]);

  return null; // This is a service component, no rendering is needed
};

export default SyncService;
