"use strict";
/** @module transition */ /** for typedoc */
var trace_1 = require("../common/trace");
var coreservices_1 = require("../common/coreservices");
var common_1 = require("../common/common");
var predicates_1 = require("../common/predicates");
var hof_1 = require("../common/hof");
var module_1 = require("./module");
var node_1 = require("../path/node");
var pathFactory_1 = require("../path/pathFactory");
var module_2 = require("../state/module");
var module_3 = require("../params/module");
var module_4 = require("../resolve/module");
var transitionCount = 0, REJECT = new module_1.RejectFactory();
var stateSelf = hof_1.prop("self");
/**
 * The representation of a transition between two states.
 *
 * Contains all contextual information about the to/from states, parameters, resolves, as well as the
 * list of states being entered and exited as a result of this transition.
 */
var Transition = (function () {
    /**
     * Creates a new Transition object.
     *
     * If the target state is not valid, an error is thrown.
     *
     * @param fromPath The path of [[Node]]s from which the transition is leaving.  The last node in the `fromPath`
     *        encapsulates the "from state".
     * @param targetState The target state and parameters being transitioned to (also, the transition options)
     * @param _transitionService The Transition Service instance
     */
    function Transition(fromPath, targetState, _transitionService) {
        var _this = this;
        this._transitionService = _transitionService;
        this._deferred = coreservices_1.services.$q.defer();
        /**
         * This promise is resolved or rejected based on the outcome of the Transition.
         *
         * When the transition is successful, the promise is resolved
         * When the transition is unsuccessful, the promise is rejected with the [[TransitionRejection]] or javascript error
         */
        this.promise = this._deferred.promise;
        this.treeChanges = function () { return _this._treeChanges; };
        this.isActive = function () { return _this === _this._options.current(); };
        if (!targetState.valid()) {
            throw new Error(targetState.error());
        }
        // Makes the Transition instance a hook registry (onStart, etc)
        module_1.HookRegistry.mixin(new module_1.HookRegistry(), this);
        // current() is assumed to come from targetState.options, but provide a naive implementation otherwise.
        this._options = common_1.extend({ current: hof_1.val(this) }, targetState.options());
        this.$id = transitionCount++;
        var toPath = pathFactory_1.PathFactory.buildToPath(fromPath, targetState);
        toPath = pathFactory_1.PathFactory.applyViewConfigs(_transitionService.$view, toPath);
        this._treeChanges = pathFactory_1.PathFactory.treeChanges(fromPath, toPath, this._options.reloadState);
        pathFactory_1.PathFactory.bindTransitionResolve(this._treeChanges, this);
    }
    Transition.prototype.$from = function () {
        return common_1.tail(this._treeChanges.from).state;
    };
    Transition.prototype.$to = function () {
        return common_1.tail(this._treeChanges.to).state;
    };
    /**
     * Returns the "from state"
     *
     * @returns The state object for the Transition's "from state".
     */
    Transition.prototype.from = function () {
        return this.$from().self;
    };
    /**
     * Returns the "to state"
     *
     * @returns The state object for the Transition's target state ("to state").
     */
    Transition.prototype.to = function () {
        return this.$to().self;
    };
    /**
     * Determines whether two transitions are equivalent.
     */
    Transition.prototype.is = function (compare) {
        if (compare instanceof Transition) {
            // TODO: Also compare parameters
            return this.is({ to: compare.$to().name, from: compare.$from().name });
        }
        return !((compare.to && !module_1.matchState(this.$to(), compare.to)) ||
            (compare.from && !module_1.matchState(this.$from(), compare.from)));
    };
    /**
     * Gets transition parameter values
     *
     * @param pathname Pick which treeChanges path to get parameters for:
     *   (`'to'`, `'from'`, `'entering'`, `'exiting'`, `'retained'`)
     * @returns transition parameter values for the desired path.
     */
    Transition.prototype.params = function (pathname) {
        if (pathname === void 0) { pathname = "to"; }
        return this._treeChanges[pathname].map(hof_1.prop("paramValues")).reduce(common_1.mergeR, {});
    };
    /**
     * Get resolved data
     *
     * @returns an object (key/value pairs) where keys are resolve names and values are any settled resolve data,
     *    or `undefined` for pending resolve data
     */
    Transition.prototype.resolves = function () {
        return common_1.map(common_1.tail(this._treeChanges.to).resolveContext.getResolvables(), function (res) { return res.data; });
    };
    /**
     * Adds new resolves to this transition.
     *
     * @param resolves an [[ResolveDeclarations]] object which describes the new resolves
     * @param state the state in the "to path" which should receive the new resolves (otherwise, the root state)
     */
    Transition.prototype.addResolves = function (resolves, state) {
        if (state === void 0) { state = ""; }
        var stateName = (typeof state === "string") ? state : state.name;
        var topath = this._treeChanges.to;
        var targetNode = common_1.find(topath, function (node) { return node.state.name === stateName; });
        common_1.tail(topath).resolveContext.addResolvables(module_4.Resolvable.makeResolvables(resolves), targetNode.state);
    };
    /**
     * Gets the previous transition, from which this transition was redirected.
     *
     * @returns The previous Transition, or null if this Transition is not the result of a redirection
     */
    Transition.prototype.previous = function () {
        return this._options.previous || null;
    };
    /**
     * Get the transition options
     *
     * @returns the options for this Transition.
     */
    Transition.prototype.options = function () {
        return this._options;
    };
    /**
     * Gets the states being entered.
     *
     * @returns an array of states that will be entered during this transition.
     */
    Transition.prototype.entering = function () {
        return common_1.map(this._treeChanges.entering, hof_1.prop('state')).map(stateSelf);
    };
    /**
     * Gets the states being exited.
     *
     * @returns an array of states that will be exited during this transition.
     */
    Transition.prototype.exiting = function () {
        return common_1.map(this._treeChanges.exiting, hof_1.prop('state')).map(stateSelf).reverse();
    };
    /**
     * Gets the states being retained.
     *
     * @returns an array of states that are already entered from a previous Transition, that will not be
     *    exited during this Transition
     */
    Transition.prototype.retained = function () {
        return common_1.map(this._treeChanges.retained, hof_1.prop('state')).map(stateSelf);
    };
    /**
     * Get the [[ViewConfig]]s associated with this Transition
     *
     * Each state can define one or more views (template/controller), which are encapsulated as `ViewConfig` objects.
     * This method fetches the `ViewConfigs` for a given path in the Transition (e.g., "to" or "entering").
     *
     * @param pathname the name of the path to fetch views for:
     *   (`'to'`, `'from'`, `'entering'`, `'exiting'`, `'retained'`)
     * @param state If provided, only returns the `ViewConfig`s for a single state in the path
     *
     * @returns a list of ViewConfig objects for the given path.
     */
    Transition.prototype.views = function (pathname, state) {
        if (pathname === void 0) { pathname = "entering"; }
        var path = this._treeChanges[pathname];
        path = !state ? path : path.filter(hof_1.propEq('state', state));
        return path.map(hof_1.prop("views")).filter(common_1.identity).reduce(common_1.unnestR, []);
    };
    /**
     * @ngdoc function
     * @name ui.router.state.type:Transition#redirect
     * @methodOf ui.router.state.type:Transition
     *
     * @description
     * Creates a new transition that is a redirection of the current one. This transition can
     * be returned from a `$transitionsProvider` hook, `$state` event, or other method, to
     * redirect a transition to a new state and/or set of parameters.
     *
     * @returns {Transition} Returns a new `Transition` instance.
     */
    Transition.prototype.redirect = function (targetState) {
        var newOptions = common_1.extend({}, this.options(), targetState.options(), { previous: this });
        targetState = new module_2.TargetState(targetState.identifier(), targetState.$state(), targetState.params(), newOptions);
        var redirectTo = new Transition(this._treeChanges.from, targetState, this._transitionService);
        var reloadState = targetState.options().reloadState;
        // If the current transition has already resolved any resolvables which are also in the redirected "to path", then
        // add those resolvables to the redirected transition.  Allows you to define a resolve at a parent level, wait for
        // the resolve, then redirect to a child state based on the result, and not have to re-fetch the resolve.
        var redirectedPath = this.treeChanges().to;
        var copyResolvesFor = node_1.Node.matching(redirectTo.treeChanges().to, redirectedPath)
            .filter(function (node) { return !reloadState || !reloadState.includes[node.state.name]; });
        var includeResolve = function (resolve, key) { return ['$stateParams', '$transition$'].indexOf(key) === -1; };
        copyResolvesFor.forEach(function (node, idx) { return common_1.extend(node.resolves, common_1.filter(redirectedPath[idx].resolves, includeResolve)); });
        return redirectTo;
    };
    /** @hidden If a transition doesn't exit/enter any states, returns any [[Param]] whose value changed */
    Transition.prototype._changedParams = function () {
        var _a = this._treeChanges, to = _a.to, from = _a.from;
        if (this._options.reload || common_1.tail(to).state !== common_1.tail(from).state)
            return undefined;
        var nodeSchemas = to.map(function (node) { return node.paramSchema; });
        var _b = [to, from].map(function (path) { return path.map(function (x) { return x.paramValues; }); }), toValues = _b[0], fromValues = _b[1];
        var tuples = common_1.arrayTuples(nodeSchemas, toValues, fromValues);
        return tuples.map(function (_a) {
            var schema = _a[0], toVals = _a[1], fromVals = _a[2];
            return module_3.Param.changed(schema, toVals, fromVals);
        }).reduce(common_1.unnestR, []);
    };
    /**
     * Returns true if the transition is dynamic.
     *
     * A transition is dynamic if no states are entered nor exited, but at least one dynamic parameter has changed.
     *
     * @returns true if the Transition is dynamic
     */
    Transition.prototype.dynamic = function () {
        var changes = this._changedParams();
        return !changes ? false : changes.map(function (x) { return x.dynamic; }).reduce(common_1.anyTrueR, false);
    };
    /**
     * Returns true if the transition is ignored.
     *
     * A transition is ignored if no states are entered nor exited, and no parameter values have changed.
     *
     * @returns true if the Transition is ignored.
     */
    Transition.prototype.ignored = function () {
        var changes = this._changedParams();
        return !changes ? false : changes.length === 0;
    };
    /**
     * @hidden
     */
    Transition.prototype.hookBuilder = function () {
        return new module_1.HookBuilder(this._transitionService, this, {
            transition: this,
            current: this._options.current
        });
    };
    /**
     * Runs the transition
     *
     * This method is generally called from the [[StateService.transitionTo]]
     *
     * @returns a promise for a successful transition.
     */
    Transition.prototype.run = function () {
        var _this = this;
        var hookBuilder = this.hookBuilder();
        var runSynchronousHooks = module_1.TransitionHook.runSynchronousHooks;
        // TODO: nuke these in favor of chaining off the promise, i.e.,
        // $transitions.onBefore({}, $transition$ => {$transition$.promise.then()}
        var runSuccessHooks = function () { return runSynchronousHooks(hookBuilder.getOnSuccessHooks(), {}, true); };
        var runErrorHooks = function ($error$) { return runSynchronousHooks(hookBuilder.getOnErrorHooks(), { $error$: $error$ }, true); };
        // Run the success/error hooks *after* the Transition promise is settled.
        this.promise.then(runSuccessHooks, runErrorHooks);
        var syncResult = runSynchronousHooks(hookBuilder.getOnBeforeHooks());
        if (module_1.TransitionHook.isRejection(syncResult)) {
            var rejectReason = syncResult.reason;
            this._deferred.reject(rejectReason);
            return this.promise;
        }
        if (!this.valid()) {
            var error = new Error(this.error());
            this._deferred.reject(error);
            return this.promise;
        }
        if (this.ignored()) {
            trace_1.trace.traceTransitionIgnored(this);
            var ignored = REJECT.ignored();
            this._deferred.reject(ignored.reason);
            return this.promise;
        }
        // When the chain is complete, then resolve or reject the deferred
        var resolve = function () {
            _this.success = true;
            _this._deferred.resolve(_this);
            trace_1.trace.traceSuccess(_this.$to(), _this);
        };
        var reject = function (error) {
            _this.success = false;
            _this._deferred.reject(error);
            trace_1.trace.traceError(error, _this);
            return coreservices_1.services.$q.reject(error);
        };
        trace_1.trace.traceTransitionStart(this);
        var chain = hookBuilder.asyncHooks().reduce(function (_chain, step) { return _chain.then(step.invokeStep); }, syncResult);
        chain.then(resolve, reject);
        return this.promise;
    };
    /**
     * Checks if the Transition is valid
     *
     * @returns true if the Transition is valid
     */
    Transition.prototype.valid = function () {
        return !this.error();
    };
    /**
     * The reason the Transition is invalid
     *
     * @returns an error message explaining why the transition is invalid
     */
    Transition.prototype.error = function () {
        var state = this.$to();
        if (state.self[common_1.abstractKey])
            return "Cannot transition to abstract state '" + state.name + "'";
        if (!module_3.Param.validates(state.parameters(), this.params()))
            return "Param values not valid for state '" + state.name + "'";
    };
    /**
     * A string representation of the Transition
     *
     * @returns A string representation of the Transition
     */
    Transition.prototype.toString = function () {
        var fromStateOrName = this.from();
        var toStateOrName = this.to();
        var avoidEmptyHash = function (params) {
            return (params["#"] !== null && params["#"] !== undefined) ? params : common_1.omit(params, "#");
        };
        // (X) means the to state is invalid.
        var id = this.$id, from = predicates_1.isObject(fromStateOrName) ? fromStateOrName.name : fromStateOrName, fromParams = common_1.toJson(avoidEmptyHash(this._treeChanges.from.map(hof_1.prop('paramValues')).reduce(common_1.mergeR, {}))), toValid = this.valid() ? "" : "(X) ", to = predicates_1.isObject(toStateOrName) ? toStateOrName.name : toStateOrName, toParams = common_1.toJson(avoidEmptyHash(this.params()));
        return "Transition#" + id + "( '" + from + "'" + fromParams + " -> " + toValid + "'" + to + "'" + toParams + " )";
    };
    return Transition;
}());
exports.Transition = Transition;
//# sourceMappingURL=transition.js.map