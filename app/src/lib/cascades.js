/* eslint-disable no-console */
import * as FileSystem from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import * as Sentry from '@sentry/react-native';

const DIR_NAME = 'SQLite';

const createSqliteDir = async () => {
  /**
   * Setup sqlite directory to save cascades sqlite from server
   */
  if (!(await FileSystem.getInfoAsync(FileSystem.documentDirectory + DIR_NAME)).exists) {
    await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory + DIR_NAME);
  }
};

const download = async (downloadUrl, fileUrl, update = false) => {
  const fileSql = fileUrl?.split('/')?.pop(); // get last segment as filename
  const pathSql = `${DIR_NAME}/${fileSql}`;
  const { exists } = await FileSystem.getInfoAsync(FileSystem.documentDirectory + pathSql);
  if (exists && update) {
    const existingDB = SQLite.openDatabaseSync(fileSql);
    existingDB.closeAsync();
    await existingDB.deleteAsync();
  }
  if (!exists || update) {
    await FileSystem.downloadAsync(downloadUrl, FileSystem.documentDirectory + pathSql, {
      cache: false,
    });
  }
};

const loadDataSource = async (source, id = null) => {
  const { file: cascadeName } = source;
  const db = await SQLite.openDatabaseAsync(cascadeName, { useNewConnection: true });
  const statement = await db.prepareAsync('SELECT * FROM nodes');
  try {
    const result = await statement.executeAsync();
    const rows = await result.getAllAsync();
    await result.resetAsync();
    return id ? rows?.find((r) => r?.id === id) : rows;
  } catch (error) {
    Sentry.captureMessage('[cascades] Unable to load cascade sqlite');
    Sentry.captureException(error, {
      extra: {
        source,
        id,
      },
    });
    return Promise.reject(error);
  } finally {
    await statement.finalizeAsync();
  }
};

const dropFiles = async () => {
  const Sqlfiles = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory + DIR_NAME);
  Sqlfiles.forEach(async (file) => {
    if (file.includes('sqlite')) {
      const fileUri = `${FileSystem.documentDirectory}${DIR_NAME}/${file}`;
      await FileSystem.deleteAsync(fileUri);
    }
  });
  return Sqlfiles;
};

const cascades = {
  createSqliteDir,
  loadDataSource,
  download,
  dropFiles,
  DIR_NAME,
};

export default cascades;
