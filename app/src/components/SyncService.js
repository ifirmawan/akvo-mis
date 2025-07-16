import { useCallback, useEffect } from 'react';
import * as Network from 'expo-network';
import { useSQLiteContext } from 'expo-sqlite';
import * as Sentry from '@sentry/react-native';
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
    if (pendingToSync?.length === 0 && activeJob?.id) {
      /**
       * If there are no pending items to sync and the job is still active,
       * delete the job.
       */
      await crudJobs.deleteJob(db, activeJob.id);
      return;
    }

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

        // Process all datapoints sequentially without transaction wrapper
        // Individual datapoint operations will handle their own transactions
        const processDatapointSequentially = async (urls) => {
          // Process URLs sequentially using reduce to avoid for...of loop
          await urls.reduce(async (previousPromise, urlData, index) => {
            await previousPromise;
            try {
              await downloadDatapointsJson(db, urlData, activeJob.user);
              // Update progress
              DatapointSyncState.update((s) => {
                s.progress = ((index + 1) / urls.length) * 100;
              });
            } catch (error) {
              // Continue processing other datapoints even if one fails
              Sentry.captureMessage(`Error downloading datapoint JSON for URL ${urlData.url}`);
              Sentry.captureException(error);
            }
          }, Promise.resolve());
        };

        await processDatapointSequentially(apiURLs);

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
        DatapointSyncState.update((s) => {
          s.draftInProgress = true;
        });

        const draftRes = await fetchDraftDatapoints();
        // Process draft datapoints sequentially without transaction wrapper
        // Individual operations will handle their own database safety
        await draftRes.reduce(async (previousPromise, draftData) => {
          await previousPromise;
          // Add a small delay to prevent overwhelming the database connection
          await new Promise((resolve) => {
            setTimeout(resolve, 1000);
          });

          const {
            administration: administrationId,
            datapoint_name: name,
            geolocation: geo,
            form: formId,
            id: draftId,
            repeats,
            ...d
          } = draftData;

          // Check if draft already exists by draftId
          const existingDraft = await crudDataPoints.getByDraftId(db, { draftId });

          if (existingDraft && existingDraft?.syncedAt) {
            // If the draft already exists, update it
            await crudDataPoints.updateDataPoint(db, {
              ...d,
              id: existingDraft.id,
              name,
              geo,
              repeats: JSON.stringify(repeats),
              submitted: 0,
              syncedAt: new Date().toISOString(),
            });
          } else {
            // Get the form for this draft
            const form = await crudForms.getByFormId(db, { formId });
            if (!form) {
              return; // Skip if form not found
            }

            // Create new draft datapoint without specifying id to avoid conflicts
            const draftDatapoint = {
              ...d,
              administrationId,
              name,
              geo,
              draftId,
              repeats: JSON.stringify(repeats),
              form: form.id,
              submitted: 0,
              user: userId,
              createdAt: new Date().toISOString(),
              syncedAt: new Date().toISOString(),
            };
            await crudDataPoints.saveDataPoint(db, draftDatapoint);
          }
        }, Promise.resolve());

        // Delete all records with draftId = NULL and syncedAt NOT NULL to prevent duplication
        await crudDataPoints.deleteDraftIdIsNull(db);

        DatapointSyncState.update((s) => {
          s.draftInProgress = false;
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
