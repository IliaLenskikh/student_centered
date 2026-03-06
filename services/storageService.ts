
const DB_NAME = 'OGE_Prep_DB';
const DB_VERSION = 1;
const AUDIO_STORE_NAME = 'audio_attempts';

export interface AudioAttempt {
  id?: number;
  storyTitle: string;
  blob: Blob;
  timestamp: string;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", request.error);
      reject(request.error);
    };

    request.onsuccess = (event) => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AUDIO_STORE_NAME)) {
        const store = db.createObjectStore(AUDIO_STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('storyTitle', 'storyTitle', { unique: false });
      }
    };
  });
};

export const saveAudioAttempt = async (storyTitle: string, blob: Blob, timestamp: string): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(AUDIO_STORE_NAME, 'readwrite');
    const store = tx.objectStore(AUDIO_STORE_NAME);
    
    const attempt: AudioAttempt = {
      storyTitle,
      blob,
      timestamp
    };

    store.add(attempt);
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("Error saving audio attempt:", error);
  }
};

export const loadAudioAttempts = async (storyTitle: string): Promise<AudioAttempt[]> => {
  try {
    const db = await openDB();
    const tx = db.transaction(AUDIO_STORE_NAME, 'readonly');
    const store = tx.objectStore(AUDIO_STORE_NAME);
    const index = store.index('storyTitle');
    const request = index.getAll(storyTitle);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error loading audio attempts:", error);
    return [];
  }
};

export const clearAudioAttempts = async (storyTitle: string): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(AUDIO_STORE_NAME, 'readwrite');
    const store = tx.objectStore(AUDIO_STORE_NAME);
    const index = store.index('storyTitle');
    const request = index.openKeyCursor(IDBKeyRange.only(storyTitle));

    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error clearing audio attempts:", error);
  }
};

export const saveInputs = (storyTitle: string, inputs: any): void => {
  try {
    localStorage.setItem(`inputs_${storyTitle}`, JSON.stringify(inputs));
  } catch (error) {
    console.error("Error saving inputs to localStorage:", error);
  }
};

export const loadInputs = (storyTitle: string): any | null => {
  try {
    const data = localStorage.getItem(`inputs_${storyTitle}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Error loading inputs from localStorage:", error);
    return null;
  }
};

export const clearInputs = (storyTitle: string): void => {
    localStorage.removeItem(`inputs_${storyTitle}`);
};
