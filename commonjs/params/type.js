"use strict";
/** @module params */ /** for typedoc */
var common_1 = require("../common/common");
var predicates_1 = require("../common/predicates");
/**
 * Wraps up a `Type` object to handle array values.
 */
function ArrayType(type, mode) {
    var _this = this;
    // Wrap non-array value as array
    function arrayWrap(val) { return predicates_1.isArray(val) ? val : (predicates_1.isDefined(val) ? [val] : []); }
    // Unwrap array value for "auto" mode. Return undefined for empty array.
    function arrayUnwrap(val) {
        switch (val.length) {
            case 0: return undefined;
            case 1: return mode === "auto" ? val[0] : val;
            default: return val;
        }
    }
    // Wraps type (.is/.encode/.decode) functions to operate on each value of an array
    function arrayHandler(callback, allTruthyMode) {
        return function handleArray(val) {
            if (predicates_1.isArray(val) && val.length === 0)
                return val;
            var arr = arrayWrap(val);
            var result = common_1.map(arr, callback);
            return (allTruthyMode === true) ? common_1.filter(result, function (x) { return !x; }).length === 0 : arrayUnwrap(result);
        };
    }
    // Wraps type (.equals) functions to operate on each value of an array
    function arrayEqualsHandler(callback) {
        return function handleArray(val1, val2) {
            var left = arrayWrap(val1), right = arrayWrap(val2);
            if (left.length !== right.length)
                return false;
            for (var i = 0; i < left.length; i++) {
                if (!callback(left[i], right[i]))
                    return false;
            }
            return true;
        };
    }
    ['encode', 'decode', 'equals', '$normalize'].map(function (name) {
        _this[name] = (name === 'equals' ? arrayEqualsHandler : arrayHandler)(type[name].bind(type));
    });
    common_1.extend(this, {
        name: type.name,
        pattern: type.pattern,
        is: arrayHandler(type.is.bind(type), true),
        $arrayMode: mode
    });
}
/**
 * Implements an interface to define custom parameter types that can be decoded from and encoded to
 * string parameters matched in a URL. Used by [[UrlMatcher]]
 * objects when matching or formatting URLs, or comparing or validating parameter values.
 *
 * See [[UrlMatcherFactory.type]] for more information on registering custom types.
 *
 * @example
 * ```
 *
 * {
 *   decode: function(val) { return parseInt(val, 10); },
 *   encode: function(val) { return val && val.toString(); },
 *   equals: function(a, b) { return this.is(a) && a === b; },
 *   is: function(val) { return angular.isNumber(val) && isFinite(val) && val % 1 === 0; },
 *   pattern: /\d+/
 * }
 * ```
 */
var Type = (function () {
    /**
     * @param def  A configuration object which contains the custom type definition.  The object's
     *        properties will override the default methods and/or pattern in `Type`'s public interface.
     * @returns a new Type object
     */
    function Type(def) {
        this.pattern = /.*/;
        common_1.extend(this, def);
    }
    // consider these four methods to be "abstract methods" that should be overridden
    /** @inheritdoc */
    Type.prototype.is = function (val, key) { return true; };
    /** @inheritdoc */
    Type.prototype.encode = function (val, key) { return val; };
    /** @inheritdoc */
    Type.prototype.decode = function (val, key) { return val; };
    /** @inheritdoc */
    Type.prototype.equals = function (a, b) { return a == b; };
    Type.prototype.$subPattern = function () {
        var sub = this.pattern.toString();
        return sub.substr(1, sub.length - 2);
    };
    Type.prototype.toString = function () {
        return "{Type:" + this.name + "}";
    };
    /** Given an encoded string, or a decoded object, returns a decoded object */
    Type.prototype.$normalize = function (val) {
        return this.is(val) ? val : this.decode(val);
    };
    /**
     * Wraps an existing custom Type as an array of Type, depending on 'mode'.
     * e.g.:
     * - urlmatcher pattern "/path?{queryParam[]:int}"
     * - url: "/path?queryParam=1&queryParam=2
     * - $stateParams.queryParam will be [1, 2]
     * if `mode` is "auto", then
     * - url: "/path?queryParam=1 will create $stateParams.queryParam: 1
     * - url: "/path?queryParam=1&queryParam=2 will create $stateParams.queryParam: [1, 2]
     */
    Type.prototype.$asArray = function (mode, isSearch) {
        if (!mode)
            return this;
        if (mode === "auto" && !isSearch)
            throw new Error("'auto' array mode is for query parameters only");
        return new ArrayType(this, mode);
    };
    return Type;
}());
exports.Type = Type;
//# sourceMappingURL=type.js.map