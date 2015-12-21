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
	var oldRegisterCallback = Polymer.Base.registerCallback;
	
	
	// Utility functions: (implemented below)
	var remixBehaviors;
	var comparePropertyDescriptors;
	
	// Implementation: 
	
	/**
	 * Override Polymer's internal registerCallback method to intercept all element registrations.
	 * @type {Function|*}
	 */
	Polymer.Base.registerCallback = function() {
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
			if (!this['_reflectR_' + property] && this._propertyEffects && this._propertyEffects[property]) {
				effects = this._propertyEffects[property];
				effects.sort(Polymer.Bind._sortPropertyEffects);
			}
			this['_reflectR_' + property] = true;
			
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
	 * 
	 * **Note:** adding behaviors after an element has been registered has several drawbacks:
	 * 
	 * 1. host attributes (and probably several other special properties) won't get overridden as expected;
	 * 2. property effects / observers calling order is undefined.
	 * (aka the behaviors will act as they are last in the list, regardless of the insertion point)
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
				remixBehaviors(proto, behaviors);
				
				behaviors.forEach(function(behavior){
					proto._prepBehavior(behavior);
				});
				
				// Re-create the missing property accessors, skipping already defined ones
				// Original Code: polymer/src/lib/bind/accessors.html#createBindings
				if (proto._propertyEffects) {
					for (var n in proto._propertyEffects) {
						//noinspection JSUnfilteredForInLoop
						var fx = proto._propertyEffects[n];
						fx.sort(Polymer.Bind._sortPropertyEffects);
						var objProp = Object.getOwnPropertyDescriptor(proto, n);
						if (!objProp || objProp.configurable) {
							Polymer.Bind._createAccessors(proto, n, fx);
						}
					}
				}
				
				// re-create the property info structure
				proto._prepPropertyInfo();
			}
			
		} else {
			// element wasn't registered yet, add a callback
			this.reflect(name, function() {
				Polymer.injectBehaviors(name, behaviors, options, true);
			});
		}
	};
	
	// Utility functions' implementation
	
	/**
	 * Tries to remix the behavior-provided properties.
	 * 
	 * Example: the prototype had a behavior that provided a `_doSomething` method. 
	 * If another behavior is injected at the end of the behaviors list and also implements `_doSomething`, it needs to 
	 * override it. So this function tries to just do this.
	 * 
	 * @param {Object} proto The prototype object to remix.
	 * @param {Array} newBehaviors The list of newly-added behaviors.
	 */
	remixBehaviors = function(proto, newBehaviors) {
		for (var i = newBehaviors.length - 1; i >= 0; i--) {
			var newBhv = newBehaviors[i];
			
			// compute the list of behaviors that precede it
			var idx = proto.behaviors.indexOf(newBhv);
			var prevBhvs = [];
			for (var j=0; j<idx; j++) {
				prevBhvs.push(proto.behaviors[j]);
			}
			
			// try to replace their properties with the current behavior's
			Object.getOwnPropertyNames(newBhv).forEach(function (n) {
				switch (n) {
					case 'hostAttributes':
					case 'registered':
					case 'properties':
					case 'observers':
					case 'listeners':
					case 'created':
					case 'attached':
					case 'detached':
					case 'attributeChanged':
					case 'configure':
					case 'ready':
						break;
					default:
						var propDescr = Object.getOwnPropertyDescriptor(proto, n);
						if (propDescr) {
							// check if the property belonged to one of the behaviors
							var found = prevBhvs.some(function(bhv){
								var descr2 = Object.getOwnPropertyDescriptor(bhv, n);
								return !!(descr2 && comparePropertyDescriptors(propDescr, descr2));
							});
							if (found && (propDescr.configurable || propDescr.configurable === undefined)) {
								Polymer.Base.copyOwnProperty(n, newBhv, proto);
							}
						} else {
							Polymer.Base.copyOwnProperty(n, newBhv, proto);
						}
						break;
				}
			}, this);
		}
	};
	
	/**
	 * Does a shallow comparison between two ES5 property descriptors and returns true if they are equal.
	 * 
	 * @param {Object} descr1 The first descriptor.
	 * @param {Object} descr2 The second descriptor.
	 * @return {Boolean} True if the two descriptors are the same.
	 */
	comparePropertyDescriptors = function(descr1, descr2) {
		if (!descr1 || !descr2) return false;
		return (
			(descr1.value === descr2.value) && 
			(descr1.writable == descr2.writable) && 
			(descr1.get === descr2.get) && 
			(descr1.set === descr2.set) && 
			(descr1.configurable === descr2.configurable) && 
			(descr1.enumerable === descr2.enumerable) );
	};
	
})(Polymer);
