import sql from '../sql';

const tableName = 'datapoints';
const fieldName = 'draftId';
const fieldType = 'INTEGER';

const up = (db) => sql.addNewColumn(db, tableName, fieldName, fieldType);

const down = (db) => sql.dropColumn(db, tableName, fieldName);

export { up, down };
