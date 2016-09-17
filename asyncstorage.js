'use strict';

// this is the new encoding format used going forward
var utils = require('./utils');
var StorageCore = require('./asyncstorage-core');
var TaskQueue = require('./taskqueue');

function Storage(dbname) {
  this._store = new StorageCore(dbname);
  this._queue = new TaskQueue();
}

Storage.prototype.sequentialize = function (callback, fun) {
  this._queue.add(fun, callback);
};

Storage.prototype.init = function (callback) {
  var self = this;
  self.sequentialize(callback, function (callback) {
    self._store.getKeys(function (err, keys) {
      if (err) {
        return callback(err);
      }
      self._keys = keys;
      return callback();
    });
  });
};

Storage.prototype.keys = function (callback) {
  var self = this;
  self.sequentialize(callback, function (callback) {
    callback(null, utils.decode(self._keys));
  });
};

Storage.prototype.setItems = function (pairs, callback) {
  var self = this;
  pairs = pairs.map(utils.encode)
  self.sequentialize(callback, function (callback) {
    for (var i = 0 ; i < pairs.length; i++) {
      var key = pairs[i][0]
      var idx = utils.sortedIndexOf(self._keys, key);
      if (self._keys[idx] !== key) {
        self._keys.splice(idx, 0, key);
      }
    }

    self._store.multiPut(pairs, callback);
  });
}

//setItem: Saves and item at the key provided.
Storage.prototype.setItem = function (key, value, callback) {
  return this.setItems([[key, value]], callback)
};

//getItem: Returns the item identified by it's key.
Storage.prototype.getItem = function (key, callback) {
  return this.getItems([key], function (errs, values) {
    if (errs && errs[0]) callback(errs[0])
    else callback(null, values[0])
  })
};

Storage.prototype.getItems = function (keys, callback) {
  var self = this
  self.sequentialize(callback, function (callback) {
    self._store.multiGet(utils.encode(keys), function (errs, values) {
      errs = errs || []
      values = values || []
      for (var i = 0; i < keys.length; i++) {
        if (errs[i]) {
          values[i] = undefined
          continue
        }

        var retval = values[i]
        if (typeof retval === 'undefined' || retval === null) {
          // 'NotFound' error, consistent with LevelDOWN API
          // yucky side-effect
          errs[i] = new Error('NotFound')
          values[i] = undefined
          continue
        }

        errs[i] = null
        if (typeof retval !== 'undefined') {
          retval = utils.decode(retval)
        }

        values[i] = retval
      }

      callback(errs, values)
    })
  })
}

//removeItem: Removes the item identified by it's key.
Storage.prototype.removeItems = function (keys, callback) {
  var self = this;
  keys = utils.encode(keys)
  self.sequentialize(callback, function (callback) {
    keys.forEach((key) => {
      var idx = utils.sortedIndexOf(self._keys, key);
      if (self._keys[idx] === key) {
        self._keys.splice(idx, 1);
      }
    })

    self._store.multiRemove(keys, callback);
  });
};

//removeItem: Removes the item identified by it's key.
Storage.prototype.removeItem = function (key, callback) {
  return this.removeItems([key], callback)
};

Storage.prototype.length = function (callback) {
  var self = this;
  self.sequentialize(callback, function (callback) {
    callback(null, self._keys.length);
  });
};

exports.Storage = Storage;
