# Polymer Reflection

A Polymer 1.0 reflection library that allows you to introspect and alter any Polymer element's prototype.

## ⚠️ Deprecated!

Note: this code is old deprecated / not useful anymore!

## Why?

Why would you want to reflect at / modify a Polymer element, you may ask?

Here's a scenario: you find a very nice custom input element implemented using Polymer, but it lacks features (e.g. 
custom validation API). But you really need those features and you are willing to implement them for the element to be 
usable (for your goal).

Possible solutions:

1. Edit the element's source code directly, optionally pulling the changes for everyone to benefit from them. 
But what if the author doesn't want them included in the official element's repository? 
Or you need them ASAP. Or the features are application-dependent (you only need them for your project / framework). 
You might end up maintaining a fork, which is pretty inconvenient.
2. Use this Reflection library to inject a custom behavior into the element that adds the missing features / alters the 
element's functionality. Which has some risks (may break after future updates), but with strict bower versioning, this 
becomes very easy to maintain.

Another example: use it as workaround for Polymer 1.0's removal of the *extend custom element* feature (which was 
available back in 0.5).

## Usage:

First of all, you must include this library RIGHT AFTER polymer.html (in order for it to intercept all element 
registrations):
```html
    <link rel="import" href="../polymer/polymer.html" />
    <link rel="import" href="../polymer-reflection/polymer-reflection.html" />
```

Then you can use the {@link Polymer#reflect} method to fetch the element's prototype:
```javascript
    prototype = Polymer.reflect('my-element');
    prototype.behaviors.push(MyExtraBehavior);
```

You can modify the prototype object in any way you want. 
If you'd like to extend it, you can use the second parameter:
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
If the element hasn't registered yet, the callback will be queued and will be called after element is imported, 
otherwise it will be executed right away.


## Inject Behaviors

The recommended method of extending a third-party element is by adding a custom behavior. 
Because of this, a specialized method has been implemented: 

```javascript
    Polymer.injectBehaviors('my-element', [ MyExtraBehavior ]);
```


If you need to insert the behavior at a specified position, you can use the third argument, which accepts an object 
that contains a list of insertion points (before, after, index) where insert the desired behaviors:
```javascript
    Polymer.injectBehaviors('my-element', MyExtraBehavior, { before: [ Existing1, Existing2 ], after: [ Existing3 ] });
    Polymer.injectBehaviors('my-element', MyExtraBehavior, { index: 0 });
    // after has higher priority
```

## <a name="implementationNotes"></a>Implementation notes

Note that this library is based on intercepting + changing course on some of Polymer's private / internal methods, 
which may change even after a minor release.

One example is [`Polymer.Base._registerFeatures`](https://github.com/Polymer/polymer/blob/master/src/lib/base.html), 
which is used because Polymer currently provides now way to query the list of registered elements. 
So the Reflection library needs to intercept all element registrations and store their prototypes in a map for further 
access.

Also, injecting behaviors after an element has been imported might have some quirks (see the API docs of 
[injectBehaviors](#api_injectBehaviors)) for details.

Thus, it is recommended to inject behaviors before an element is registered (i.e. call `Polymer.injectBehaviors` before 
the element is imported) for the best compatibility.


## API Reference

### Polymer.reflect(name, [op])

Reflects on a Polymer element, returning its prototype (if available) and can, optionally, extend it or invoke a callback 
function when the element's prototype is available.

*Parameters*
* `name {String}` The name of the element to reflect.
* `[op] {Object|Function}` The object to mix with or the callback function to call.

*Returns*
* `{Object|false}` The element's prototype; false if it hasn't registered yet.


### <a name="api_injectBehaviors"></a>Polymer.injectBehaviors(name, behaviors, [options])

Injects the specified behaviors to the element's prototype. 
If the element has not registered yet, it queues a callback function that will do the job.

**Note:** adding behaviors after an element has been registered has several drawbacks:

1. host attributes (and probably several other special properties) won't get overridden as expected;
2. property effects / observers calling order is not quite right (the behaviors will act as they are last in the list, 
   regardless of the insertion point).

If you rely on any of these, you must call this method before the element is imported / registered!

*Parameters*
* `name {String}` The name of the element to reflect.
* `behaviors {Array}` The behaviors to inject.
* `[options] {Object}` An object that describes the insertion point of the behaviors.

*Returns*
* No return value is defined for this method. The behaviors will be injected after it was registered.
