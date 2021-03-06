;(function(){

/**
 * Require the given path.
 *
 * @param {String} path
 * @return {Object} exports
 * @api public
 */

function require(path, parent, orig) {
  var resolved = require.resolve(path);

  // lookup failed
  if (null == resolved) {
    orig = orig || path;
    parent = parent || 'root';
    var err = new Error('Failed to require "' + orig + '" from "' + parent + '"');
    err.path = orig;
    err.parent = parent;
    err.require = true;
    throw err;
  }

  var module = require.modules[resolved];

  // perform real require()
  // by invoking the module's
  // registered function
  if (!module._resolving && !module.exports) {
    var mod = {};
    mod.exports = {};
    mod.client = mod.component = true;
    module._resolving = true;
    module.call(this, mod.exports, require.relative(resolved), mod);
    delete module._resolving;
    module.exports = mod.exports;
  }

  return module.exports;
}

/**
 * Registered modules.
 */

require.modules = {};

/**
 * Registered aliases.
 */

require.aliases = {};

/**
 * Resolve `path`.
 *
 * Lookup:
 *
 *   - PATH/index.js
 *   - PATH.js
 *   - PATH
 *
 * @param {String} path
 * @return {String} path or null
 * @api private
 */

require.resolve = function(path) {
  if (path.charAt(0) === '/') path = path.slice(1);

  var paths = [
    path,
    path + '.js',
    path + '.json',
    path + '/index.js',
    path + '/index.json'
  ];

  for (var i = 0; i < paths.length; i++) {
    var path = paths[i];
    if (require.modules.hasOwnProperty(path)) return path;
    if (require.aliases.hasOwnProperty(path)) return require.aliases[path];
  }
};

/**
 * Normalize `path` relative to the current path.
 *
 * @param {String} curr
 * @param {String} path
 * @return {String}
 * @api private
 */

require.normalize = function(curr, path) {
  var segs = [];

  if ('.' != path.charAt(0)) return path;

  curr = curr.split('/');
  path = path.split('/');

  for (var i = 0; i < path.length; ++i) {
    if ('..' == path[i]) {
      curr.pop();
    } else if ('.' != path[i] && '' != path[i]) {
      segs.push(path[i]);
    }
  }

  return curr.concat(segs).join('/');
};

/**
 * Register module at `path` with callback `definition`.
 *
 * @param {String} path
 * @param {Function} definition
 * @api private
 */

require.register = function(path, definition) {
  require.modules[path] = definition;
};

/**
 * Alias a module definition.
 *
 * @param {String} from
 * @param {String} to
 * @api private
 */

require.alias = function(from, to) {
  if (!require.modules.hasOwnProperty(from)) {
    throw new Error('Failed to alias "' + from + '", it does not exist');
  }
  require.aliases[to] = from;
};

/**
 * Return a require function relative to the `parent` path.
 *
 * @param {String} parent
 * @return {Function}
 * @api private
 */

require.relative = function(parent) {
  var p = require.normalize(parent, '..');

  /**
   * lastIndexOf helper.
   */

  function lastIndexOf(arr, obj) {
    var i = arr.length;
    while (i--) {
      if (arr[i] === obj) return i;
    }
    return -1;
  }

  /**
   * The relative require() itself.
   */

  function localRequire(path) {
    var resolved = localRequire.resolve(path);
    return require(resolved, parent, path);
  }

  /**
   * Resolve relative to the parent.
   */

  localRequire.resolve = function(path) {
    var c = path.charAt(0);
    if ('/' == c) return path.slice(1);
    if ('.' == c) return require.normalize(p, path);

    // resolve deps by returning
    // the dep in the nearest "deps"
    // directory
    var segs = parent.split('/');
    var i = lastIndexOf(segs, 'deps') + 1;
    if (!i) i = 0;
    path = segs.slice(0, i + 1).join('/') + '/deps/' + path;
    return path;
  };

  /**
   * Check if module is defined at `path`.
   */

  localRequire.exists = function(path) {
    return require.modules.hasOwnProperty(localRequire.resolve(path));
  };

  return localRequire;
};
require.register("component-path/index.js", function(exports, require, module){

exports.basename = function(path){
  return path.split('/').pop();
};

exports.dirname = function(path){
  return path.split('/').slice(0, -1).join('/') || '.'; 
};

exports.extname = function(path){
  var base = exports.basename(path);
  if (!~base.indexOf('.')) return '';
  var ext = base.split('.').pop();
  return '.' + ext;
};
});
require.register("fs/index.js", function(exports, require, module){
module.exports = (window.requestFileSystem || window.webkitRequestFileSystem)
  ? require('./filesystem')
  : require('./indexeddb');

module.exports.DirectoryEntry = require('./directory_entry');

module.exports.DirectoryEntry.prototype.readFile = function (callback) {
  if (this.type !== 'file') {
    throw new TypeError('Not a file.');
  }
  return module.exports.readFile(this.path, callback);
};
});
require.register("fs/directory_entry.js", function(exports, require, module){
var path = require('path');

function DirectoryEntry(fullPath, type) {
  this.path = fullPath;
  this.name = path.basename(fullPath);
  this.dir = path.dirname(fullPath);
  this.type = type;
}

module.exports = DirectoryEntry;
});
require.register("fs/filesystem.js", function(exports, require, module){
var fs = null;
function ensureSize(size, then) {
  var rFS = window.requestFileSystem
    || window.webkitRequestFileSystem;
  
  var storageInfo = window.webkitStorageInfo
    || navigator.webkitPersistentStorage;

  var pers = window.PERSISTENT;

  storageInfo.requestQuota(pers, size, function (grantedBytes) {
    rFS(pers, grantedBytes, function (fss) {
      fs = fss;
      then(fs);
    });
  });
}

function init(then) {
  if (fs) {
    then(fs); return;
  }

  ensureSize(1024 * 1024, then);
}

var readFile = function (fileName, callback, readMethod) {
  init(function (fs) {
    fs.root.getFile(fileName, {},
      function onSuccess(fileEntry) {
        fileEntry.file(function (file) {
          var reader = new FileReader();

          reader.onloadend = function (e) {
            callback(null, this.result);
          };

          reader[readMethod](file);
        });
      },
      function onError(err) {
        callback(err);
      });
  });
}

exports.readFile = function (fileName, callback) {
  return readFile(fileName, callback, 'readAsArrayBuffer');
};

exports.readString = function (fileName, callback) {
  return readFile(fileName, callback, 'readAsText');
};

exports.writeFile = function (fileName, data, callback) {
  if (!Array.isArray(data)
    && !(data instanceof File)) {
    if (data instanceof ArrayBuffer) {
      var view = new Uint8Array(data);
      data = new Blob([view]);
    } else {
      data = new Blob([data]);
    }
  }

  ensureSize(data.size, function (fs) {
    fs.root.getFile(fileName, { create: true }, function (fileEntry) {
      fileEntry.createWriter(function (fileWriter) {
        var err = null;
        fileWriter.onwriteend = function (e) {
          callback(err);
        };

        fileWriter.onerror = function (e) {
          err = e.toString();
        };

        fileWriter.write(data);
      });
    }, function onError(err) {
      callback(err);
    });
  });
};

exports.removeFile = function (fileName, callback) {
  init(function (fs) {
    fs.root.getFile(fileName, { create: false }, function (fileEntry) {
      fileEntry.remove(callback);
    }, callback);
  });
};

exports.readdir = function (directoryName, callback) {
  init(function (fs) {
    var readdir = function (dirEntry) {
      if (!dirEntry.isDirectory) {
        callback('Not a directory'); return;
      }

      var dirReader = dirEntry.createReader(), entries = [];
      var readEntries = function () {
        dirReader.readEntries(function (results) {
          if (!results.length) {
            callback(null, entries);
          } else {
            results = Array.prototype.slice.call(results || []);
            entries = entries.concat(results.map(function(result) {
              return new exports.DirectoryEntry(result.fullPath,
                result.isDirectory ? 'directory' : 'file');
            }));
            readEntries();
          }
        });
      };

      readEntries();
    };

    if(['','.','/'].indexOf(directoryName) !== -1) {
      readdir(fs.root);
    } else {
      fs.root.getDirectory(directoryName, { create: true }, readdir);
    }
  });
};

exports.mkdir = function (path, callback) {
  init(function (fs) {
    fs.root.getDirectory(path, { create: true }, function () {
      callback();
    }, function (err) {
      callback(err);
    });
  });
};

exports.rmdir = function (path, callback) {
  init(function (fs) {
    fs.root.getDirectory(path, {}, function (dirEntry) {
      dirEntry.remove(callback);
    });
  });
};

});
require.register("fs/indexeddb.js", function(exports, require, module){
var path = require('path');

function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint16Array(buf));
}
function str2ab(str) {
  var buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
  var bufView = new Uint16Array(buf);
  for (var i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

var DB_NAME = window.location.host + '_filesystem',
    OS_NAME = 'files',
    DIR_IDX = 'dir';

function init(callback) {
  var req = window.indexedDB.open(DB_NAME, 1);

  req.onupgradeneeded = function (e) {
    var db = e.target.result;

    var objectStore = db.createObjectStore(OS_NAME, { keyPath: 'path' });
    objectStore.createIndex(DIR_IDX, 'dir', { unique: false });
  };

  req.onsuccess = function (e) {
    callback(e.target.result);
  };
}

function initOS(type, callback) {
  init(function (db) {
    var trans = db.transaction([OS_NAME], type),
        os = trans.objectStore(OS_NAME);

    callback(os);
  });
}

var readFile = function (fileName, callback) {
  initOS('readonly', function (os) {
    var req = os.get(fileName);

    req.onerror = function (e) {
      callback(e);
    };

    req.onsuccess = function (e) {
      var res = e.target.result;

      if (res && res.data) {
        callback(null, res.data);
      } else {
        callback('File not found');
      }
    };
  });
};

exports.readFile = function (fileName, callback) {
  readFile(fileName, function (err, data) {
    if (!err && !(data instanceof ArrayBuffer)) {
      data = str2ab(data.toString());
    }
    callback(err, data);
  });
};

exports.readString = function (fileName, callback) {
  readFile(fileName, function (err, data) {
    if (!err && (data instanceof ArrayBuffer)) {
      data = ab2str(data);
    }
    callback(err, data);
  });
};

exports.writeFile = function (fileName, data, callback) {
  initOS('readwrite', function (os) {
    var req = os.put({
      "path": fileName,
      "dir": path.dirname(fileName),
      "type": "file",
      "data": data
    });

    req.onerror = function (e) {
      callback(e);
    };

    req.onsuccess = function (e) {
      callback(null);
    };
  });
};

exports.removeFile = function (fileName, callback) {
  initOS('readwrite', function (os) {
    var req = os.delete(fileName);

    req.onerror = req.onsuccess = function (e) {
      callback();
    };
  });
};

function withTrailingSlash(path) {
  var directoryWithTrailingSlash = path[path.length - 1] === '/'
    ? path
    : path + '/';
  return directoryWithTrailingSlash;
}

exports.readdir = function (directoryName, callback) {
  initOS('readonly', function (os) {
    var dir = path.dirname(withTrailingSlash(directoryName));

    var idx = os.index(DIR_IDX);
    var range = IDBKeyRange.only(dir);
    var req = idx.openCursor(range);

    req.onerror = function (e) {
      callback(e);
    };

    var results = [];
    req.onsuccess = function (e) {
      var cursor = e.target.result;
      if (cursor) {
        var value = cursor.value;
        var entry = new exports.DirectoryEntry(value.path, value.type);
        results.push(entry);
        cursor.continue();
      } else {
        callback(null, results);
      }
    };
  });
};

exports.mkdir = function (fullPath, callback) {
  initOS('readwrite', function (os) {
    var dir = withTrailingSlash(path);
   
    var req = os.put({
      "path": fullPath,
      "dir": path.dirname(dir),
      "type": "directory"
    });

    req.onerror = function (e) {
      callback(e);
    };

    req.onsuccess = function (e) {
      callback(null);
    };
  });
};

exports.rmdir = function (fullPath, callback) {
  exports.readdir(fullPath, function removeFiles(files) {
    if (!files || !files.length) {
      return exports.removeFile(fullPath, callback);
    }

    var file = files.shift(),
        func = file.type === 'directory'
          ? exports.rmdir
          : exports.removeFile;

    func(file.name, function () {
      removeFiles(files);
    });
  });
};
});
require.alias("component-path/index.js", "fs/deps/path/index.js");
require.alias("component-path/index.js", "path/index.js");
if (typeof exports == "object") {
  module.exports = require("fs");
} else if (typeof define == "function" && define.amd) {
  define(function(){ return require("fs"); });
} else {
  this["fs"] = require("fs");
}})();