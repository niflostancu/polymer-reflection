(function(Polymer) {
	
	/**
	 * Stores a map with the elements' prototypes.
	 * 
	 * @private
	 * @type {Object<String,Object>}
	 */
	var reflectionRegistry = {};
	
	/**
	 * A map with the callbacks registered through {@link Polymer#reflect} that haven't been yet executed.
	 * 
	 * @type {Object<String,Array>}
	 */
	var reflectionCallbacks = {};
	
	
	// save the old Polymer registration callback
	var oldRegisterCallback = Polymer.Base._registerFeatures;
	
	
	// Implementation: 
	
	/**
	 * Override Polymer's internal registerFeatures callback to intercept all element registrations.
	 * @type {Function|*}
	 */
	Polymer.Base._registerFeatures = function() {
		if (this.is) {
			reflectionRegistry[this.is] = this;
			
			// check for queued callbacks
			if (reflectionCallbacks[this.is]) {
				var proto = this;
				reflectionCallbacks[this.is].forEach(function (op) {
					op(proto);
				});
				reflectionCallbacks[this.is] = null;
				delete reflectionCallbacks[this.is];
			}
		}
		
		if (oldRegisterCallback) {
			oldRegisterCallback.apply(this, arguments);
		}
		
		/**
		 * The property setters need to be patched in order to apply the current property effects (not the ones at 
		 * registration time) for observers to work correctly with the behaviors added via reflection.
		 * 
		 * Original Code: polymer/src/lib/bind/accessors.html:46
		 */
		var oldPropertySetter = this._propertySetter;
		this._propertySetter = function (property, value, effects, extra, extra2, extra3) {
			// infer the current effects
			if (!this._reflectEffectsReplaced && this._propertyEffects && this._propertyEffects[property]) {
				effects = this._propertyEffects[property];
				effects.sort(Polymer.Bind._sortPropertyEffects);
			}
			this._reflectEffectsReplaced = true;
			
			return oldPropertySetter.call(this, property, value, effects, extra, extra2, extra3);
		};
	};
	
	/**
	 * Reflects at a Polymer element, returning its prototype and optionally extending it with a custom object.
	 * 
	 * @param {String} name The name of the element to reflect.
	 * @param {Function|Object} [op] The object to mix with / the callback function to call.
	 * @return {Object|false} The element's prototype; false if it hasn't registered yet.
	 */
	Polymer.reflect = function(name, op) {
		if (!name)
			return null; // element not registered (yet?)
		
		var proto = reflectionRegistry[name];
		
		if (typeof op == 'function') {
			if (proto) {
				op(proto);
				
			} else {
				if (!reflectionCallbacks[name])
					reflectionCallbacks[name] = [];
				reflectionCallbacks[name].push(op);
			}
			
		} else if (typeof op == 'object') {
			if (!proto)
				return false;
			Polymer.Base.extend.call(proto, proto, op);
		}
		
		return (proto ? proto : false);
	};
	
	/**
	 * Injects the specified behaviors to the element's prototype.
	 * If the element has not registered yet, it queues a callback function that will do the job.
	 * **Note:** adding behaviors after an element has been registered has several drawbacks:
	 * 1. existing prototype methods won't get overridden as expected;
	 * 2. the same with host attributes (and probably several other special properties);
	 * 3. property effects / observers calling order is undefined.
	 *
	 * Aka the behaviors will act as they are last in the list, regardless of the insertion point)
	 *
	 * If you rely on any of these, you must call this method before the element is imported / registered!
	 * 
	 * @param {String} name The name of the element to reflect.
	 * @param {Array} behaviors The behaviors to inject.
	 * @param {Object} [options] An object that describes the insertion point of the behaviors.
	 * @param {Boolean} [_regPhase] Internal method, do not use. Will be true if the call was made within the registration 
	 *                              callback.
	 */
	Polymer.injectBehaviors = function(name, behaviors, options, _regPhase) {
		if (!name) return;
		var proto = reflectionRegistry[name];
		if (proto) {
			if (!proto.behaviors)
				proto.behaviors = [];
			
			// try to determine the insertion point
			var idx = undefined;
			if (options) {
				if (options.before) {
					idx = proto.behaviors.length - 1;
					options.before.forEach(function (behavior) {
						var found = proto.behaviors.indexOf(behavior);
						if (found >= 0 && found < idx) idx = found;
					});
				}
				if (options.after) {
					if (idx === undefined) idx = 0;
					options.after.forEach(function(behavior) {
						var found = proto.behaviors.indexOf(behavior);
						if (found >= 0 && found >= idx) idx = found + 1;
					});
				}
				if (options.index) idx = options.index;
				if (idx === undefined || idx > proto.behaviors.length) 
					idx = proto.behaviors.length;
			} else {
				idx = proto.behaviors.length; // add it as the last behavior
			}
			// and, finally, add them
			behaviors.forEach(function(behavior){
				proto.behaviors.splice(idx, 0, behavior);
				idx++;
			});
			
			if (!_regPhase) {
				// simulate behavior registration (has drawbacks, but should work fine for most of the cases)
				behaviors.forEach(function(behavior){
					proto._mixinBehavior(behavior);
					proto._prepBehavior(behavior);
				});
				
				// ensure all observed properties have setters
				if (proto._propertyEffects) {
					for (var n in proto._propertyEffects) {
						if (!proto._propertyEffects.hasOwnProperty(n)) continue;
						var fx = proto._propertyEffects[n];
						fx.sort(Polymer.Bind._sortPropertyEffects);
						var objProp = Object.getOwnPropertyDescriptor(proto, n);
						if (!objProp || objProp.configurable)
							Polymer.Bind._createAccessors(proto, n, fx);
					}
				}
			}
			
		} else {
			// element wasn't registered yet, add a callback
			this.reflect(name, function() {
				Polymer.injectBehaviors(name, behaviors, options, true);
			});
		}
	};
	
	
})(Polymer);
