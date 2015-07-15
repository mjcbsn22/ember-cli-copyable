import Ember from 'ember';
import DS from 'ember-data';

var Copyable = Ember.Mixin.create({
  copyable: true,
  copy: function(options) {
    options = options || {};

    var _this = this;
    return new Ember.RSVP.Promise(function(resolve) {

      var model = _this.constructor;
      var copy = _this.get('store').createRecord(model.modelName || model.typeKey);
      var queue = [];

      model.eachAttribute(function(attr) {
        switch(Ember.typeOf(options[attr])) {
          case 'undefined':
              copy.set(attr, _this.get(attr));
              break;
          case 'null':
              copy.set(attr, null);
              break;
          default:
              copy.set(attr, options[attr]);
        }
      });

      model.eachRelationship(function(relName, meta) {
        var rel = _this.get(relName);
        if (!rel) { return; }

        var overwrite;
        var passedOptions = {};
        switch(Ember.typeOf(options[relName])) {
          case 'null':
              return;
          case 'instance':
              overwrite = options[relName];
              break;
          case 'object':
              passedOptions = options[relName];
              break;
          case 'array':
              overwrite = options[relName];
              break;
          default:
        }

        if (rel.constructor === DS.PromiseObject) {

          queue.pushObject(rel.then(function(obj) {

            if (obj && obj.get('copyable')) {
              return obj.copy(passedOptions).then(function(objCopy) {
                copy.set(relName, overwrite || objCopy);
              });

            } else {
              copy.set(relName, overwrite || obj);
            }

          }));


        } else if (rel.constructor === DS.PromiseManyArray) {

          if (overwrite) {
            copy.get(relName).pushObjects(overwrite);
          } else {
            queue.pushObject(rel.then(function(array) {

              array.forEach(function(obj) {
                if (obj.get('copyable')) {
                  return obj.copy(passedOptions).then(function(objCopy) {
                    copy.get(relName).pushObject(objCopy);
                  });

                } else {
                  copy.get(relName).pushObject(obj);
                }
              });
            }));
          }

        } else {

          if (meta.kind === 'belongsTo') {
            var obj = rel;

            if (obj && obj.get('copyable')) {
              queue.pushObject( obj.copy(passedOptions).then(function(objCopy) {
                copy.set(relName, overwrite || objCopy);
              }));

            } else {
              copy.set(relName, overwrite || obj);
            }

          } else {
            var objs = rel;

            if (objs.get('content')) {
              objs = objs.get('content').compact();
            }

            if (objs.get('firstObject.copyable')) {

              var copies = objs.map(function(obj) {
                return obj.copy(passedOptions);
              });

              if (overwrite) {
                copy.get(relName).pushObjects(overwrite);
              } else {
                queue.pushObject( Ember.RSVP.all(copies).then( function(resolvedCopies) {
                  copy.get(relName).pushObjects(resolvedCopies);
                }));
              }


            } else {
              copy.get(relName).pushObjects(overwrite || objs);
            }
          }

        }
      });


      Ember.RSVP.all(queue).then(function() {
        resolve(copy);
      });
    });
  }
});

export default Copyable;
