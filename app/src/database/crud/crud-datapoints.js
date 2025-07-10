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
    const rows = sql.getFilteredRows(db, 'datapoints', { ...columns }, 'createdAt', 'DESC', true);
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
    },
  ) => {
    const repeatsVal = repeats ? { repeats } : {};
    const submittedAt = submitted ? { submittedAt: new Date().toISOString() } : {};
    const geoVal = geo ? { geo } : {};
    const uuidVal = uuid ? { uuid } : {};
    const syncedAtVal = syncedAt ? { syncedAt } : {};
    const admVal = administrationId ? { administrationId } : {};
    const draftVal = draftId ? { draftId } : {};
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
    });
    return res;
  },
  updateDataPoint: async (
    db,
    { id, name, geo, submitted, duration, submittedAt, syncedAt, json, repeats },
  ) => {
    const repeatsVal = repeats ? { repeats } : {};
    const submittedVal = submitted !== undefined ? { submitted } : {};
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
    const rows = await sql.executeQuery(
      db,
      `SELECT * FROM datapoints WHERE submitted = ? AND draftId IS NULL OR syncedAt IS NOT NULL`,
      [0],
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
    const res = await sql.executeQuery(
      db,
      'DELETE FROM datapoints WHERE submitted = ? AND draftId IS NULL',
      [0],
    );
    return res;
  },
  getByUUID: async (db, { uuid }) => {
    const res = await sql.getFirstRow(db, 'datapoints', { uuid });
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
});

const crudDataPoints = dataPointsQuery();

export default crudDataPoints;
