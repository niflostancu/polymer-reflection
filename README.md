# Polymer Reflection

A Polymer 1.0 reflection library that allows you to introspect and alter any Polymer element's prototype.

**Warning:** This is highly experimental (i.e. even future minor Polymer versions might break it and it will need 
re-adaptation to work). See [Implementation Notes](#implementationNotes) for an explanation.

## Why?

Why would you want to reflect at a Polymer element's prototype, you may ask?

Here's a scenario: you find a very nice custom input element implemented using Polymer, but it lacks features (e.g. 
custom validation API). But you need those features and you are willing to implement them for the element to be usable.

Possible solutions:
1. Edit the source code of the element and push back the changes for everyone to benefit from them. But what if the author 
doesn't want them included in the official element's repository? Or you need them ASAP. Or the features are application-
dependent and you only need them for your project. You might end up maintaining a fork, which is pretty inconvenient.
2. Use this Reflection library to inject a custom behavior into the element that adds the missing features / alters the 
element's behavior.

Other examples: you may also use it to complement for Polymer 1.0's lack of custom element extension feature (available 
in 0.5).

## Usage:

First of all, you must import this library RIGHT AFTER polymer.html (in order for it to intercept all element 
registrations):
```html
    <link rel="import" href="../polymer/polymer.html" />
    <link rel="import" href="../polymer-reflection/polymer-reflection.html" />
```

Then, you use the {@link Polymer#reflect} method to return an element's prototype:
```javascript
    prototype = Polymer.reflect('my-element');
    prototype.behaviors.push(MyExtraBehavior);
```

You can modify the element's prototype in any way you want. If you'd like to extend it, you can use the second 
parameter:
```javascript
    Polymer.reflect('my-element', {
        myProperty: 123,
        myMethod: function() { }
    });
```

**Note:** if you want to modify the element's prototype, you must call the reflect method before any instance has been 
created, but after the element itself is imported / registered.

As solution to this problem, you can supply a callback function as the second argument of the reflect method:
```javascript
    Polymer.reflect('my-element', function(proto) {
        // do something with the prototype
    });
```

You can call this at any time during the Polymer element registration phase (i.e. inside the document's `<head>`). 
If the element hasn't registered yet, the callback will be queued to be called when the element is imported, otherwise 
it will be called right away.


## Inject Behaviors

The recommended method of extending a third-party element is by adding a behavior. Because of this, a specialized 
method has been implemented: 

```javascript
    Polymer.injectBehaviors('my-element', [ MyExtraBehavior ]);
```


If you need to insert the behavior at a specified position, you can use the third argument, which accepts an object 
that contains a list of behaviors before/after which to insert the custom behavior:
```javascript
    Polymer.injectBehaviors('my-element', MyExtraBehavior, { before: [ Existing1, Existing2 ], after: [ Existing3 ] });
    // after has higher priority
```

## <a name="implementationNotes"></a>Implementation notes

Note that this library is based on intercepting some of Polymer private / internal methods, which may change even on 
minor versions.

One such method is [`Polymer.Base._registerFeatures`](https://github.com/Polymer/polymer/blob/master/src/lib/base.html), 
which is used because Polymer currently provides now way to retrieve a list of registered elements. 
So the Reflection library needs to intercept all element prototype registrations and store them all in a map for further 
access.

Also, injecting behaviors after an element has been imported might have some unintended consequences (see the API docs 
on [injectBehaviors](#api_injectBehaviors)) for details. 

Thus, it is recommended to inject behaviors before an element is registered (i.e. call `Polymer.injectBehaviors` before 
the element is imported) for maximum compatibility.


## API Reference

### Polymer.reflect(name, [op])

Reflects at a Polymer element, returning its prototype (if available) and can, optionally, extend it or invoke a callback 
function when the element's prototype is available.

*Parameters*
* `name {String}` The name of the element to reflect.
* `[op] {Object|Function}` The object to mix with or the callback function to call.

*Returns*
* `{Object|false}` The element's prototype; false if it hasn't registered yet.


### <a name="api_injectBehaviors"></a>Polymer.injectBehaviors(name, behaviors, [options], [_regPhase])

Injects the specified behaviors to the element's prototype. 
If the element has not registered yet, it queues a callback function that will do the job.

**Note:** adding behaviors after an element has been registered has several drawbacks:
1. existing prototype methods won't get overridden as expected;
2. the same with host attributes (and probably several other special properties);
3. property effects / observers calling order is undefined.

Aka the behaviors will act as they are last in the list, regardless of the insertion point)
 
If you rely on any of these, you must call this method before the element is imported / registered!

*Parameters*
* `name {String}` The name of the element to reflect.
* `behaviors {Array}` The behaviors to inject.
* `[options] {Object}` An object that describes the insertion point of the behaviors.
* `[_regPhase] {Boolean}` Internal method, do not use. Will be true if the call was made within the registration callback.

*Returns*
* No return value is defined for this method. The behaviors will be injected after it was registered.

