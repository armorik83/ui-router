"use strict";
// Defines the available policies and their ordinals.
(function (ResolvePolicy) {
    ResolvePolicy[ResolvePolicy["JIT"] = 0] = "JIT";
    ResolvePolicy[ResolvePolicy["LAZY"] = 1] = "LAZY";
    ResolvePolicy[ResolvePolicy["EAGER"] = 2] = "EAGER"; // Eager resolves are resolved before the transition starts.
})(exports.ResolvePolicy || (exports.ResolvePolicy = {}));
var ResolvePolicy = exports.ResolvePolicy;
//# sourceMappingURL=interface.js.map