import sql from '../sql';

const selectDataPointById = async (db, { id }) => {
  const current = await sql.getFirstRow(db, 'datapoints', { id });
  if (!current) {
    return false;
  }
  let jsonVal = JSON.parse(current.json.replace(/''/g, "'"));
  // If json is a string that starts with '{', parse it as JSON
  if (typeof jsonVal === 'string' && jsonVal.startsWith('{')) {
    jsonVal = JSON.parse(jsonVal);
  }
  return {
    ...current,
    json: jsonVal,
  };
};

const dataPointsQuery = () => ({
  selectDataPointById,
  selectDataPointsByFormAndSubmitted: async (db, { form, submitted, user, uuid }) => {
    const uuidVal = uuid ? { uuid } : {};
    const userVal = user ? { user } : {};
    const columns = { form, submitted, ...userVal, ...uuidVal };
    const rows = await sql.getFilteredRows(db, 'datapoints', { ...columns }, 'id', 'DESC', true);
    return rows;
  },
  selectSubmissionToSync: async (db) => {
    const rows = await sql.executeQuery(
      db,
      `SELECT
          datapoints.*,
          forms.formId,
          forms.json AS json_form
        FROM datapoints
        JOIN forms ON datapoints.form = forms.id
        WHERE datapoints.syncedAt IS NULL
        ORDER BY datapoints.createdAt ASC`,
    );
    return rows;
  },
  saveDataPoint: async (
    db,
    {
      uuid,
      form,
      user,
      name,
      geo,
      submitted,
      duration,
      json,
      repeats,
      syncedAt,
      administrationId,
      draftId,
      id,
    },
  ) => {
    const repeatsVal = repeats ? { repeats } : {};
    const submittedAt = submitted ? { submittedAt: new Date().toISOString() } : {};
    const geoVal = geo ? { geo } : {};
    const uuidVal = uuid ? { uuid } : {};
    const syncedAtVal = syncedAt ? { syncedAt } : {};
    const admVal = administrationId ? { administrationId } : {};
    const draftVal = draftId ? { draftId } : {};
    const idVal = id ? { id } : {};
    const res = await sql.insertRow(db, 'datapoints', {
      form,
      user,
      name,
      submitted,
      duration,
      createdAt: new Date().toISOString(),
      json: json ? JSON.stringify(json).replace(/'/g, "''") : null,
      ...geoVal,
      ...submittedAt,
      ...repeatsVal,
      ...uuidVal,
      ...syncedAtVal,
      ...admVal,
      ...draftVal,
      ...idVal,
    });
    return res;
  },
  updateDataPoint: async (
    db,
    { id, name, geo, submitted, duration, submittedAt, syncedAt, json, repeats },
  ) => {
    const repeatsVal = repeats ? { repeats } : {};
    const submittedVal = submitted !== undefined ? { submitted } : {};
    const syncedAtVal = syncedAt ? { syncedAt } : {};
    const res = await sql.updateRow(
      db,
      'datapoints',
      { id },
      {
        name,
        geo,
        duration,
        syncedAt,
        submittedAt: submitted && !submittedAt ? new Date().toISOString() : submittedAt,
        json: json ? JSON.stringify(json).replace(/'/g, "''") : null,
        ...submittedVal,
        ...repeatsVal,
        ...syncedAtVal,
      },
    );
    return res;
  },
  saveToDraft: async (db, id) => {
    const res = await sql.updateRow(
      db,
      'datapoints',
      { id },
      {
        submitted: 0,
      },
    );
    return res;
  },
  getDraftPendingSync: async (db) => {
    const rows = await sql.safeExecuteQuery(
      db,
      `SELECT * FROM datapoints WHERE (submitted = ? AND draftId IS NULL) OR syncedAt IS NOT NULL`,
      [0],
      'getDraftPendingSync',
    );
    return rows;
  },
  getByDraftId: async (db, { draftId }) => {
    const res = await sql.getFirstRow(db, 'datapoints', { draftId });
    if (!res) {
      return false;
    }
    return {
      ...res,
      json: JSON.parse(res.json.replace(/''/g, "'")),
    };
  },
  deleteDraftIdIsNull: async (db) => {
    const res = await sql.safeExecuteQuery(
      db,
      'DELETE FROM datapoints WHERE submitted = ? AND draftId IS NULL AND syncedAt IS NOT NULL',
      [0],
      'deleteDraftIdIsNull',
    );
    return res;
  },
  deleteById: async (db, { id }) => {
    const res = await sql.deleteRow(db, 'datapoints', id);
    return res;
  },
  deleteDraftSynced: async (db) => {
    const res = await sql.safeExecuteQuery(
      db,
      'DELETE FROM datapoints WHERE draftId IS NOT NULL AND syncedAt IS NOT NULL',
      [],
      'deleteDraftSynced',
    );
    return res;
  },
  getByUUID: async (db, { uuid, form }) => {
    const formVal = form ? { form } : {};
    const res = await sql.getFirstRow(db, 'datapoints', { uuid, ...formVal });
    return res;
  },
  updateByUUID: async (db, { uuid, json, syncedAt, repeats }) => {
    if (!json || typeof json !== 'object') {
      return false;
    }
    const repeatsVal = repeats ? { repeats } : {};
    const res = await sql.updateRow(
      db,
      'datapoints',
      { uuid },
      {
        json: JSON.stringify(json).replace(/'/g, "''"),
        syncedAt: syncedAt || new Date().toISOString(),
        ...repeatsVal,
      },
    );
    return res;
  },
  totalSavedData: async (db, formDBId, uuid = null) => {
    try {
      if (uuid) {
        const res = await sql.safeGetFirstRow(
          db,
          'SELECT COUNT(*) AS total FROM datapoints WHERE submitted = ? AND form = ? AND uuid = ?',
          [0, formDBId, uuid],
          'totalSavedData with uuid',
        );
        return res?.total || 0;
      }
      const res = await sql.safeGetFirstRow(
        db,
        'SELECT COUNT(*) AS total FROM datapoints WHERE submitted = ? AND form = ?',
        [0, formDBId],
        'totalSavedData without uuid',
      );
      return res?.total || 0;
    } catch (error) {
      throw new Error(`Error in totalSavedData: ${error.message}`);
    }
  },
  /**
   * Upsert a datapoint - update if exists, insert if not
   * @param {Object} db - Database instance
   * @param {Object} data - Datapoint data
   * @returns {Promise<number>} - The ID of the inserted/updated datapoint
   */
  upsertDataPoint: async (db, data) => {
    try {
      const { id, ...dataWithoutId } = data;

      if (id) {
        // Check if datapoint with this ID exists
        const existing = await crudDataPoints.selectDataPointById(db, { id });

        if (existing) {
          // Update existing datapoint
          await crudDataPoints.updateDataPoint(db, { id, ...dataWithoutId });
          return id;
        }

        // Insert with specific ID
        try {
          return await sql.insertRow(db, 'datapoints', data);
        } catch (error) {
          if (error.message.includes('UNIQUE constraint failed')) {
            // If ID conflict, insert without ID (auto-generate)
            return sql.insertRow(db, 'datapoints', dataWithoutId);
          }
          throw error;
        }
      }

      // No ID specified, just insert
      return sql.insertRow(db, 'datapoints', dataWithoutId);
    } catch (error) {
      throw new Error(`Error in upsertDataPoint: ${error.message}`);
    }
  },
  /**
   * Check for and resolve datapoint ID conflicts
   * @param {Object} db - Database instance
   * @returns {Promise<number>} - Number of conflicts resolved
   */
  resolveDatapointIdConflicts: async (db) => {
    try {
      // Find duplicate IDs that might cause conflicts
      const duplicates = await sql.executeQuery(
        db,
        `SELECT id, COUNT(*) as count FROM datapoints 
         GROUP BY id 
         HAVING COUNT(*) > 1`,
        [],
      );

      if (duplicates.length === 0) {
        return 0;
      }

      const resolveConflict = async (duplicate) => {
        // Get all datapoints with this ID
        const conflictingRows = await sql.executeQuery(
          db,
          `SELECT * FROM datapoints WHERE id = ? ORDER BY createdAt DESC`,
          [duplicate.id],
        );

        if (conflictingRows.length > 1) {
          // Keep the most recent one, update others to have new IDs
          const [, ...updateRows] = conflictingRows;

          const resolveRow = async (row) => {
            // Create new record without ID (auto-generate)
            const { id: _, ...dataWithoutId } = row;
            await sql.insertRow(db, 'datapoints', dataWithoutId);

            // Delete the old conflicting record
            await sql.deleteRow(db, 'datapoints', row.id);
            return 1;
          };

          const results = await Promise.all(updateRows.map(resolveRow));
          return results.reduce((sum, count) => sum + count, 0);
        }
        return 0;
      };

      const results = await Promise.all(duplicates.map(resolveConflict));
      return results.reduce((sum, count) => sum + count, 0);
    } catch (error) {
      throw new Error(`Error resolving datapoint ID conflicts: ${error.message}`);
    }
  },
});

const crudDataPoints = dataPointsQuery();

export default crudDataPoints;
