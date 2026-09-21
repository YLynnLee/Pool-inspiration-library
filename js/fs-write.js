// Thin File System Access shell: the only code that touches disk. Per
// CONTRIBUTING.md, untested by unit tests, same
// convention as the DOM code in render.js. Depends on curation.js.
(function () {
  'use strict';

  var DB_NAME = 'pool';
  var STORE_NAME = 'file-handles';
  var DIR_KEY = 'projectDir';

  // Served by the local helper (http://localhost:4747), the page is a
  // different origin from the index.html file, so a folder granted there
  // isn't visible here. The helper already knows the folder, so saves go
  // through it instead — no picker. Resolves null when there's no helper
  // behind this page (some other static server), so the caller falls back
  // to the folder picker. See SECURITY.md.
  var SERVED = window.location.protocol === 'http:' || window.location.protocol === 'https:';

  function viaHelper(endpoint, body) {
    if (!SERVED) return Promise.resolve(null);
    return fetch('/api/files/' + endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(
      function (res) {
        if (res.status === 404 || res.status === 405) return null;
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || 'The helper could not save that.');
          return data;
        });
      },
      function () {
        throw new Error('Lost contact with Pool. Start it again, then retry.');
      }
    );
  }

  // In-memory cache so a granted permission is reused for the rest of this
  // page load without touching IndexedDB again.
  var cachedDirHandle = null;

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = window.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore(STORE_NAME);
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  function idbGet(key) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
        req.onsuccess = function () {
          resolve(req.result || null);
        };
        req.onerror = function () {
          reject(req.error);
        };
      });
    });
  }

  function idbSet(key, value) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(value, key);
        tx.oncomplete = function () {
          resolve();
        };
        tx.onerror = function () {
          reject(tx.error);
        };
      });
    });
  }

  // Silently checks the standing grant first; only falls back to a prompt
  // (which needs the user gesture the caller is already inside) if asking
  // is actually necessary. This is what keeps the permission cost to at
  // most once per session rather than once per write.
  function ensurePermission(handle) {
    return handle.queryPermission({ mode: 'readwrite' }).then(function (status) {
      if (status === 'granted') return true;
      return handle.requestPermission({ mode: 'readwrite' }).then(function (result) {
        return result === 'granted';
      });
    });
  }

  // The picker's default landing folder is the OS's, which is almost never
  // where the project lives. The app already knows its own location, so
  // read the enclosing well-known folder out of the path and start there —
  // adaptive rather than hardcoded, since the project folder can move.
  function guessStartIn() {
    var wellKnown = ['desktop', 'documents', 'downloads', 'music', 'pictures'];
    var path = decodeURIComponent(window.location.pathname).toLowerCase();
    for (var i = 0; i < wellKnown.length; i++) {
      if (path.indexOf('/' + wellKnown[i] + '/') !== -1) return wellKnown[i];
    }
    return null;
  }

  function pickProjectDirHandle() {
    var options = { id: 'pool-project', mode: 'readwrite' };
    var startIn = guessStartIn();
    if (startIn) options.startIn = startIn;
    return window.showDirectoryPicker(options);
  }

  // Shared handle-acquisition path: check the in-memory cache, then
  // IndexedDB for a standing grant, and only fall back to a picker (which
  // needs the user gesture the caller is already inside) when neither has
  // one. One grant covers both files this module writes, so the collector
  // sees at most one native picker per session instead of one per file.
  function getProjectDirHandle() {
    if (cachedDirHandle) return Promise.resolve(cachedDirHandle);
    return idbGet(DIR_KEY)
      .catch(function () {
        return null; // IndexedDB unavailable — fall through to the picker
      })
      .then(function (stored) {
        if (stored) {
          cachedDirHandle = stored;
          return stored;
        }
        return pickProjectDirHandle().then(function (handle) {
          cachedDirHandle = handle;
          return idbSet(DIR_KEY, handle)
            .catch(function () {
              /* handle still usable this session even if it can't be persisted */
            })
            .then(function () {
              return handle;
            });
        });
      });
  }

  // Drops the cached grant so the next write re-prompts from scratch,
  // rather than repeatedly failing against a folder that was never right.
  function forgetProjectDir() {
    cachedDirHandle = null;
    return idbSet(DIR_KEY, null).catch(function () {
      /* nothing to clean up if IndexedDB isn't available */
    });
  }

  // Resolves inbox.md and data/library.js inside the granted folder. A
  // folder missing either file is the wrong folder — surfaced as a clear
  // error, with the bad grant forgotten, rather than caching a handle that
  // can never satisfy a write.
  function locateProjectFiles(dirHandle) {
    return dirHandle
      .getFileHandle('inbox.md')
      .catch(function () {
        return forgetProjectDir().then(function () {
          throw new Error(
            'Could not find inbox.md in the selected folder. Pick the Pool project folder and try again.'
          );
        });
      })
      .then(function (inboxHandle) {
        return dirHandle
          .getDirectoryHandle('data')
          .then(function (dataDir) {
            return dataDir.getFileHandle('library.js');
          })
          .catch(function () {
            return forgetProjectDir().then(function () {
              throw new Error(
                'Could not find data/library.js in the selected folder. Pick the Pool project folder and try again.'
              );
            });
          })
          .then(function (libraryHandle) {
            return { inbox: inboxHandle, library: libraryHandle };
          });
      });
  }

  function getProjectFiles() {
    return getProjectDirHandle().then(function (dirHandle) {
      return ensurePermission(dirHandle).then(function (granted) {
        if (!granted) {
          throw new Error('Permission to access the project folder was denied. Nothing was saved.');
        }
        return locateProjectFiles(dirHandle);
      });
    });
  }

  // Appends one capture line to inbox.md. Resolves on a confirmed write,
  // rejects with a message safe to show the collector on denial or
  // failure. Never called except from a deliberate Add action.
  function appendToInbox(url, note) {
    return viaHelper('inbox', { url: url, note: note || '' }).then(function (done) {
      return done ? undefined : appendToInboxInFolder(url, note);
    });
  }

  // Taking a capture back out of the inbox needs the helper, which can read
  // inbox.md; from file:// there is nothing that shows the inbox to remove from.
  function removeFromInbox(line) {
    return viaHelper('inbox-remove', { line: line }).then(function (done) {
      if (!done) throw new Error('Start the library helper to manage the inbox.');
    });
  }

  function appendToInboxInFolder(url, note) {
    if (!window.showDirectoryPicker) {
      return Promise.reject(
        new Error('This browser does not support writing files. Try Chrome.')
      );
    }
    var inboxHandle;
    return getProjectFiles()
      .then(function (files) {
        inboxHandle = files.inbox;
        return inboxHandle.getFile();
      })
      .then(function (file) {
        return file.text();
      })
      .then(function (existingText) {
        var nextText = window.appendCaptureLine(existingText, url, note);
        return inboxHandle.createWritable().then(function (writable) {
          return writable.write(nextText).then(function () {
            return writable.close();
          });
        });
      });
  }

  // Overwrites data/library.js with new source text. Used by a purge or a
  // draft resolution, in direct response to the collector confirming it —
  // never on load, never on a timer. FSA's createWritable() swaps the file
  // atomically on close(), so a write that throws before close() leaves the
  // file on disk untouched; there is nothing to roll back here.
  function writeLibrary(text) {
    return viaHelper('write', { file: 'data/library.js', text: text }).then(function (done) {
      return done ? undefined : writeLibraryInFolder(text);
    });
  }

  function writeLibraryInFolder(text) {
    if (!window.showDirectoryPicker) {
      return Promise.reject(
        new Error('This browser does not support writing files. Try Chrome.')
      );
    }
    return getProjectFiles()
      .then(function (files) {
        return files.library.createWritable();
      })
      .then(function (writable) {
        return writable.write(text).then(function () {
          return writable.close();
        });
      });
  }

  // Overwrites data/design-systems.js. Same contract as writeLibrary: only
  // called from a confirmed purge.
  function writeDesignSystems(text) {
    return viaHelper('write', { file: 'data/design-systems.js', text: text }).then(function (done) {
      return done ? undefined : writeDesignSystemsInFolder(text);
    });
  }

  function writeDesignSystemsInFolder(text) {
    if (!window.showDirectoryPicker) {
      return Promise.reject(
        new Error('This browser does not support writing files. Try Chrome.')
      );
    }
    return getProjectFiles()
      .then(function (files) {
        return getProjectDirHandle().then(function (dir) {
          return dir.getDirectoryHandle('data');
        });
      })
      .then(function (dataDir) {
        return dataDir.getFileHandle('design-systems.js');
      })
      .then(function (handle) {
        return handle.createWritable();
      })
      .then(function (writable) {
        return writable.write(text).then(function () {
          return writable.close();
        });
      });
  }

  // Deletes screenshot files (paths like 'images/foo.webp') from the project
  // folder. A file that is already gone counts as deleted. Resolves with the
  // paths that could not be removed, so a purge can report them instead of
  // failing after the data files were already rewritten.
  function deleteImages(paths) {
    return viaHelper('delete-images', { paths: paths }).then(function (done) {
      return done ? done.failed : deleteImagesInFolder(paths);
    });
  }

  function deleteImagesInFolder(paths) {
    return getProjectDirHandle().then(function (dir) {
      var failed = [];
      return paths
        .reduce(function (chain, path) {
          return chain.then(function () {
            var parts = path.split('/');
            var name = parts.pop();
            return parts
              .reduce(function (p, part) {
                return p.then(function (d) {
                  return d.getDirectoryHandle(part);
                });
              }, Promise.resolve(dir))
              .then(function (d) {
                return d.removeEntry(name);
              })
              .catch(function (err) {
                if (!err || err.name !== 'NotFoundError') failed.push(path);
              });
          });
        }, Promise.resolve())
        .then(function () {
          return failed;
        });
    });
  }

  // Fallback for the DESIGN.md download (.scratch/design-system-extraction
  // /issues/06) when the blob + <a download> path is unavailable. Unlike
  // appendToInbox/writeLibrary this targets wherever the collector chooses
  // via the browser's own save picker, not the fixed project folder, so it
  // goes through showSaveFilePicker rather than getProjectFiles().
  function saveDesignMdFile(filename, text) {
    if (!window.showSaveFilePicker) {
      return Promise.reject(
        new Error('This browser does not support the save picker. Try Chrome, or use Copy instead.')
      );
    }
    return window
      .showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Design system markdown', accept: { 'text/markdown': ['.md'] } }],
      })
      .then(function (handle) {
        return handle.createWritable();
      })
      .then(function (writable) {
        return writable.write(text).then(function () {
          return writable.close();
        });
      });
  }

  window.appendToInbox = appendToInbox;
  window.removeFromInbox = removeFromInbox;
  window.writeLibrary = writeLibrary;
  window.writeDesignSystems = writeDesignSystems;
  window.deleteImages = deleteImages;
  window.saveDesignMdFile = saveDesignMdFile;
})();
