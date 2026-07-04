/*
  EtLayersHost.jsx
  ExtendScript bridge for the EtLayers CEP extension.

  This file owns all Adobe After Effects API access. The React application must
  communicate with it through CSInterface.evalScript and must never call AE APIs
  directly.
*/

var EtLayersHostRoot = (typeof $ !== "undefined" && $.global) ? $.global : globalThis;

if (!EtLayersHostRoot.EtLayersHost) {
    EtLayersHostRoot.EtLayersHost = {};
}

var EtLayersHost = EtLayersHostRoot.EtLayersHost;

(function (api) {
    var cache = {
        compId: "",
        fingerprint: "",
        activeLayers: [],
        recursiveLayers: [],
        projectAudit: null,
        projectAuditFingerprint: "",
        refreshedAt: ""
    };

    function safeCall(fn, fallbackValue) {
        try {
            return fn();
        } catch (error) {
            return fallbackValue;
        }
    }

    function jsonStringify(value) {
        return safeCall(function () {
            return JSON.stringify(value);
        }, "{\"ok\":false,\"error\":\"JSON serialization failed.\"}");
    }

    function respond(ok, data, errorMessage) {
        return jsonStringify({
            ok: ok,
            data: data || null,
            error: errorMessage || ""
        });
    }

    function isInstanceOf(value, className) {
        return safeCall(function () {
            return typeof $.global[className] !== "undefined" &&
                value instanceof $.global[className];
        }, false);
    }

    function isCompItem(item) {
        if (!item) {
            return false;
        }

        if (isInstanceOf(item, "CompItem")) {
            return true;
        }

        return safeCall(function () {
            return typeof item.numLayers !== "undefined" &&
                typeof item.layer !== "undefined" &&
                typeof item.duration !== "undefined";
        }, false);
    }

    function getActiveComp() {
        return safeCall(function () {
            if (!app || !app.project || !isCompItem(app.project.activeItem)) {
                return null;
            }

            return app.project.activeItem;
        }, null);
    }

    function normalizeText(value) {
        if (value === null || typeof value === "undefined") {
            return "";
        }

        return String(value).toLowerCase();
    }

    function getCompId(comp) {
        return safeCall(function () {
            return String(comp.id || comp.name + ":" + comp.numLayers + ":" + comp.duration);
        }, "");
    }

    function getCompById(compId) {
        return safeCall(function () {
            if (!app || !app.project) {
                return null;
            }

            for (var i = 1; i <= app.project.numItems; i += 1) {
                var item = app.project.item(i);

                if (isCompItem(item) && getCompId(item) === String(compId)) {
                    return item;
                }
            }

            return null;
        }, null);
    }

    function getItemId(item) {
        return safeCall(function () {
            return String(item.id || item.name + ":" + item.typeName + ":" + item.index);
        }, "");
    }

    function getProjectItemById(itemId) {
        return safeCall(function () {
            if (!app || !app.project) {
                return null;
            }

            for (var i = 1; i <= app.project.numItems; i += 1) {
                var item = app.project.item(i);

                if (getItemId(item) === String(itemId)) {
                    return item;
                }
            }

            return null;
        }, null);
    }

    function getCompositionInfo(comp) {
        if (!isCompItem(comp)) {
            return null;
        }

        return {
            id: getCompId(comp),
            name: safeCall(function () { return comp.name; }, "Active Composition"),
            layerCount: safeCall(function () { return comp.numLayers; }, 0),
            width: safeCall(function () { return comp.width; }, 0),
            height: safeCall(function () { return comp.height; }, 0),
            duration: safeCall(function () { return comp.duration; }, 0),
            frameRate: safeCall(function () { return comp.frameRate; }, 0)
        };
    }

    function getSelectedLayerIds(comp) {
        return safeCall(function () {
            var selectedLayers = comp.selectedLayers;
            var ids = [];

            for (var i = 0; i < selectedLayers.length; i += 1) {
                ids.push(getCompId(comp) + ":" + selectedLayers[i].index);
            }

            return ids;
        }, []);
    }

    function getProjectFingerprint() {
        return safeCall(function () {
            if (!app || !app.project) {
                return "no-project";
            }

            var parts = [];
            var activeComp = getActiveComp();
            var revision = safeCall(function () {
                return app.project.revision;
            }, null);

            parts.push("items:" + app.project.numItems);
            parts.push("revision:" + revision);

            if (activeComp) {
                parts.push("active:" + getCompId(activeComp));
                parts.push("selected:" + getSelectedLayerIds(activeComp).join(","));
            } else {
                parts.push("active:none");
            }

            if (revision !== null && typeof revision !== "undefined") {
                return parts.join("|");
            }

            for (var i = 1; i <= app.project.numItems; i += 1) {
                var item = app.project.item(i);

                if (!isCompItem(item)) {
                    parts.push("item:" + i + ":" + safeCall(function () { return item.name; }, ""));
                    continue;
                }

                parts.push("comp:" + getCompId(item) + ":" + item.name + ":" + item.numLayers);

                for (var layerIndex = 1; layerIndex <= item.numLayers; layerIndex += 1) {
                    var layer = item.layer(layerIndex);
                    var sourceId = safeCall(function () {
                        return layer.source && isCompItem(layer.source) ? getCompId(layer.source) : "";
                    }, "");

                    parts.push(layerIndex + ":" + layer.name + ":" + sourceId + ":" + layer.enabled + ":" + layer.locked + ":" + layer.shy);
                }
            }

            return parts.join("|");
        }, String(new Date().getTime()));
    }

    function getLayerType(layer) {
        if (!layer) {
            return "unknown";
        }

        if (isInstanceOf(layer, "TextLayer") || safeCall(function () {
            return layer.matchName === "ADBE Text Layer" ||
                layer.property("ADBE Text Properties") !== null;
        }, false)) {
            return "text";
        }

        if (isInstanceOf(layer, "ShapeLayer") || safeCall(function () {
            return layer.matchName === "ADBE Vector Layer";
        }, false)) {
            return "shape";
        }

        if (isInstanceOf(layer, "CameraLayer") || safeCall(function () {
            return layer.matchName === "ADBE Camera Layer";
        }, false)) {
            return "camera";
        }

        if (isInstanceOf(layer, "LightLayer") || safeCall(function () {
            return layer.matchName === "ADBE Light Layer";
        }, false)) {
            return "light";
        }

        if (safeCall(function () {
            return layer.nullLayer === true;
        }, false)) {
            return "nullLayer";
        }

        if (safeCall(function () {
            return layer.adjustmentLayer === true;
        }, false)) {
            return "adjustment";
        }

        if (safeCall(function () {
            return layer.source &&
                layer.source.mainSource &&
                (isInstanceOf(layer.source.mainSource, "SolidSource") ||
                    typeof layer.source.mainSource.color !== "undefined");
        }, false)) {
            return "solid";
        }

        return "other";
    }

    function createLayerRecord(layer, layerIndex, comp, compPath) {
        var name = safeCall(function () {
            return layer.name;
        }, "Layer " + layerIndex);
        var type = getLayerType(layer);
        var compInfo = getCompositionInfo(comp);
        var path = compPath || [compInfo ? compInfo.name : "Composition"];
        var compId = compInfo ? compInfo.id : "";
        var labelIndex = safeCall(function () { return layer.label; }, 0);
        var parentLayer = safeCall(function () { return layer.parent; }, null);

        return {
            id: compId + ":" + layerIndex,
            index: layerIndex,
            name: name,
            normalizedName: normalizeText(name),
            type: type,
            compId: compId,
            compName: compInfo ? compInfo.name : "",
            compPath: path,
            breadcrumb: path.join(" > "),
            groupId: compId,
            groupName: compInfo ? compInfo.name : "",
            locked: safeCall(function () { return layer.locked === true; }, false),
            shy: safeCall(function () { return layer.shy === true; }, false),
            enabled: safeCall(function () { return layer.enabled !== false; }, true),
            selected: safeCall(function () { return layer.selected === true; }, false),
            solo: safeCall(function () { return layer.solo === true; }, false),
            parented: parentLayer !== null,
            parentName: parentLayer ? safeCall(function () { return parentLayer.name; }, "") : "",
            label: labelIndex,
            labelName: getLabelName(labelIndex),
            inPoint: safeCall(function () { return layer.inPoint; }, 0),
            outPoint: safeCall(function () { return layer.outPoint; }, 0)
        };
    }

    function countBrokenExpressionsInGroup(group) {
        var count = 0;
        var propertyCount = safeCall(function () {
            return group.numProperties;
        }, 0);

        for (var i = 1; i <= propertyCount; i += 1) {
            var property = safeCall(function () {
                return group.property(i);
            }, null);

            if (!property) {
                continue;
            }

            var isLeafProperty = safeCall(function () {
                return property.propertyType === PropertyType.PROPERTY;
            }, false);

            if (isLeafProperty) {
                count += safeCall(function () {
                    if (!property.canSetExpression || property.expression === "") {
                        return 0;
                    }

                    return property.expressionError !== "" ? 1 : 0;
                }, 0);
            } else {
                count += countBrokenExpressionsInGroup(property);
            }
        }

        return count;
    }

    function createEmptyStats() {
        return {
            layers: 0,
            text: 0,
            shapes: 0,
            nulls: 0,
            solids: 0,
            adjustments: 0,
            cameras: 0,
            lights: 0,
            locked: 0,
            hidden: 0,
            disabled: 0,
            brokenExpressions: 0
        };
    }

    function incrementType(stats, type) {
        if (type === "text") {
            stats.text += 1;
        } else if (type === "shape") {
            stats.shapes += 1;
        } else if (type === "nullLayer") {
            stats.nulls += 1;
        } else if (type === "solid") {
            stats.solids += 1;
        } else if (type === "adjustment") {
            stats.adjustments += 1;
        } else if (type === "camera") {
            stats.cameras += 1;
        } else if (type === "light") {
            stats.lights += 1;
        }
    }

    function collectStats(comp) {
        var stats = createEmptyStats();
        var layerCount = safeCall(function () {
            return comp.numLayers;
        }, 0);

        stats.layers = layerCount;

        for (var i = 1; i <= layerCount; i += 1) {
            var layer = safeCall(function () {
                return comp.layer(i);
            }, null);

            if (!layer) {
                continue;
            }

            incrementType(stats, getLayerType(layer));

            if (safeCall(function () { return layer.locked === true; }, false)) {
                stats.locked += 1;
            }

            if (safeCall(function () { return layer.shy === true; }, false)) {
                stats.hidden += 1;
            }

            if (safeCall(function () { return layer.enabled === false; }, false)) {
                stats.disabled += 1;
            }

            stats.brokenExpressions += countBrokenExpressionsInGroup(layer);
        }

        return stats;
    }

    function isPrecompLayer(layer) {
        return safeCall(function () {
            return layer.source && isCompItem(layer.source);
        }, false);
    }

    function collectLayers(comp, includePrecomps, compPath, visited) {
        var layers = [];
        var layerCount = safeCall(function () {
            return comp.numLayers;
        }, 0);
        var compId = getCompId(comp);

        if (visited[compId]) {
            return layers;
        }

        visited[compId] = true;

        for (var i = 1; i <= layerCount; i += 1) {
            var layer = safeCall(function () {
                return comp.layer(i);
            }, null);

            if (layer) {
                layers.push(createLayerRecord(layer, i, comp, compPath));

                if (includePrecomps && isPrecompLayer(layer)) {
                    var childComp = safeCall(function () {
                        return layer.source;
                    }, null);

                    if (childComp) {
                        var childPath = compPath.slice(0);
                        childPath.push(safeCall(function () { return childComp.name; }, "Precomp"));
                        layers = layers.concat(collectLayers(childComp, includePrecomps, childPath, visited));
                    }
                }
            }
        }

        visited[compId] = false;
        return layers;
    }

    function buildSnapshot(comp, includePrecomps) {
        var fingerprint = getProjectFingerprint();
        var compInfo = getCompositionInfo(comp);
        var compPath = [compInfo ? compInfo.name : "Active Composition"];
        var activeLayers = collectLayers(comp, false, compPath, {});
        var recursiveLayers = includePrecomps ? collectLayers(comp, true, compPath, {}) : [];

        cache.compId = getCompId(comp);
        cache.fingerprint = fingerprint;
        cache.activeLayers = activeLayers;
        cache.recursiveLayers = recursiveLayers;
        cache.refreshedAt = String(new Date().getTime());

        return {
            comp: compInfo,
            stats: collectStats(comp),
            layers: includePrecomps ? recursiveLayers : activeLayers,
            projectFingerprint: fingerprint,
            refreshedAt: cache.refreshedAt
        };
    }

    function ensureSnapshot(includePrecomps) {
        var comp = getActiveComp();
        var fingerprint = getProjectFingerprint();

        if (!comp) {
            return null;
        }

        if (cache.compId !== getCompId(comp) || cache.fingerprint !== fingerprint ||
                cache.activeLayers.length === 0 || (includePrecomps && cache.recursiveLayers.length === 0)) {
            return buildSnapshot(comp, includePrecomps);
        }

        return {
            comp: getCompositionInfo(comp),
            stats: collectStats(comp),
            layers: includePrecomps ? cache.recursiveLayers : cache.activeLayers,
            projectFingerprint: fingerprint,
            refreshedAt: cache.refreshedAt
        };
    }

    function filterLayers(query, includePrecomps) {
        var snapshot = ensureSnapshot(includePrecomps);
        var normalizedQuery = normalizeText(query);
        var results = [];
        var seen = {};
        var i;

        if (!snapshot) {
            return null;
        }

        if (normalizedQuery === "") {
            return snapshot;
        }

        for (i = 0; i < snapshot.layers.length; i += 1) {
            if (getLayerSearchText(snapshot.layers[i]).indexOf(normalizedQuery) === 0 ||
                    snapshot.layers[i].normalizedName.indexOf(normalizedQuery) === 0) {
                results.push(snapshot.layers[i]);
                seen[snapshot.layers[i].id] = true;
            }
        }

        for (i = 0; i < snapshot.layers.length; i += 1) {
            if (getLayerSearchText(snapshot.layers[i]).indexOf(normalizedQuery) > 0 &&
                    !seen[snapshot.layers[i].id]) {
                results.push(snapshot.layers[i]);
                seen[snapshot.layers[i].id] = true;
            }
        }

        snapshot.layers = results;
        return snapshot;
    }

    function getLabelName(labelIndex) {
        var labels = {
            0: "None",
            1: "Red",
            2: "Yellow",
            3: "Aqua",
            4: "Pink",
            5: "Lavender",
            6: "Peach",
            7: "Sea Foam",
            8: "Blue",
            9: "Green",
            10: "Purple",
            11: "Orange",
            12: "Brown",
            13: "Fuchsia",
            14: "Cyan",
            15: "Sandstone",
            16: "Dark Green"
        };

        return labels[labelIndex] || ("Label " + labelIndex);
    }

    function getLayerSearchText(layerRecord) {
        var words = [
            layerRecord.name,
            layerRecord.normalizedName,
            layerRecord.type,
            layerRecord.labelName,
            "label " + layerRecord.label,
            layerRecord.compName,
            layerRecord.breadcrumb,
            layerRecord.parentName
        ];

        if (layerRecord.locked) {
            words.push("locked");
        }
        if (layerRecord.shy) {
            words.push("hidden shy");
        }
        if (layerRecord.solo) {
            words.push("solo");
        }
        if (layerRecord.selected) {
            words.push("selected");
        }
        if (layerRecord.parented) {
            words.push("parented parent");
        }
        if (layerRecord.enabled === false) {
            words.push("disabled hidden");
        }

        return normalizeText(words.join(" "));
    }

    function getLabelForType(type) {
        var labels = {
            text: 8,
            shape: 2,
            nullLayer: 11,
            solid: 14,
            adjustment: 1,
            camera: 10,
            light: 9
        };

        if (typeof labels[type] !== "undefined") {
            return labels[type];
        }

        return null;
    }

    function isFootageItem(item) {
        return item && isInstanceOf(item, "FootageItem");
    }

    function createProjectIssue(type, status, severity, icon, item, detail, itemKind, suffix) {
        return {
            id: type + ":" + getItemId(item) + ":" + (suffix || "0"),
            type: type,
            status: status,
            severity: severity,
            icon: icon,
            name: safeCall(function () { return item.name; }, "Project Item"),
            detail: detail || "",
            itemId: getItemId(item),
            itemKind: itemKind || (isCompItem(item) ? "comp" : "footage")
        };
    }

    function createIssueGroup(type, label, issues) {
        return {
            type: type,
            label: label,
            count: issues.length,
            issues: issues
        };
    }

    function getFootagePath(item) {
        return safeCall(function () {
            if (item.file) {
                return item.file.fsName;
            }

            if (item.mainSource && item.mainSource.file) {
                return item.mainSource.file.fsName;
            }

            return "";
        }, "");
    }

    function isPlaceholderFootage(item) {
        return safeCall(function () {
            return item.mainSource && isInstanceOf(item.mainSource, "PlaceholderSource");
        }, false);
    }

    function isTestAsset(item) {
        return safeCall(function () {
            var name = normalizeText(item.name);
            return name.indexOf("color bar") !== -1 ||
                name.indexOf("colour bar") !== -1 ||
                name.indexOf("test") !== -1 ||
                name.indexOf("slate") !== -1 ||
                name.indexOf("placeholder") !== -1;
        }, false);
    }

    function collectUsedItemIds() {
        var used = {};

        safeCall(function () {
            for (var i = 1; i <= app.project.numItems; i += 1) {
                var item = app.project.item(i);

                if (!isCompItem(item)) {
                    continue;
                }

                for (var layerIndex = 1; layerIndex <= item.numLayers; layerIndex += 1) {
                    var layer = item.layer(layerIndex);
                    var source = safeCall(function () { return layer.source; }, null);

                    if (source) {
                        used[getItemId(source)] = true;
                    }
                }
            }
        }, null);

        return used;
    }

    function collectBrokenExpressionIssues() {
        var issues = [];

        safeCall(function () {
            for (var i = 1; i <= app.project.numItems; i += 1) {
                var item = app.project.item(i);

                if (!isCompItem(item)) {
                    continue;
                }

                for (var layerIndex = 1; layerIndex <= item.numLayers; layerIndex += 1) {
                    var layer = item.layer(layerIndex);
                    var brokenCount = countBrokenExpressionsInGroup(layer);

                    if (brokenCount > 0) {
                        issues.push(createProjectIssue(
                            "brokenExpressions",
                            "Broken",
                            "error",
                            "fx",
                            item,
                            layer.name + " has " + brokenCount + " broken expression" + (brokenCount === 1 ? "" : "s") + ".",
                            "comp",
                            String(layerIndex)
                        ));
                    }
                }
            }
        }, null);

        return issues;
    }

    function buildProjectAudit() {
        var fingerprint = getProjectFingerprint();

        if (cache.projectAudit && cache.projectAuditFingerprint === fingerprint) {
            return cache.projectAudit;
        }

        var missingFootage = [];
        var missingFonts = [];
        var offlineProxies = [];
        var placeholderFootage = [];
        var testAssets = [];
        var duplicateFootage = [];
        var unusedFootage = [];
        var emptyComps = [];
        var brokenExpressions = collectBrokenExpressionIssues();
        var usedItemIds = collectUsedItemIds();
        var footageByPath = {};
        var i;

        safeCall(function () {
            for (i = 1; i <= app.project.numItems; i += 1) {
                var item = app.project.item(i);

                if (isCompItem(item)) {
                    if (item.numLayers === 0) {
                        emptyComps.push(createProjectIssue("emptyComps", "Empty", "warning", "comp", item, "Composition has no layers.", "comp"));
                    }
                    continue;
                }

                if (!isFootageItem(item)) {
                    continue;
                }

                var path = getFootagePath(item);

                if (safeCall(function () { return item.footageMissing === true; }, false)) {
                    missingFootage.push(createProjectIssue("missingFootage", "Missing", "error", "!", item, path || "Source file is missing.", "footage"));
                }

                if (safeCall(function () { return item.useProxy === true && item.proxySource && item.proxySource.footageMissing === true; }, false)) {
                    offlineProxies.push(createProjectIssue("offlineProxies", "Offline Proxy", "warning", "proxy", item, "Proxy source is offline.", "footage"));
                }

                if (isPlaceholderFootage(item)) {
                    placeholderFootage.push(createProjectIssue("placeholderFootage", "Placeholder", "warning", "ph", item, "Placeholder footage source.", "footage"));
                }

                if (isTestAsset(item)) {
                    testAssets.push(createProjectIssue("testAssets", "Test Asset", "info", "test", item, path, "footage"));
                }

                if (!usedItemIds[getItemId(item)]) {
                    unusedFootage.push(createProjectIssue("unusedFootage", "Unused", "info", "off", item, path || "Not used by any comp layer.", "footage"));
                }

                if (path !== "") {
                    if (!footageByPath[path]) {
                        footageByPath[path] = [];
                    }
                    footageByPath[path].push(item);
                }
            }

            for (var duplicatePath in footageByPath) {
                if (footageByPath.hasOwnProperty(duplicatePath) && footageByPath[duplicatePath].length > 1) {
                    for (var duplicateIndex = 0; duplicateIndex < footageByPath[duplicatePath].length; duplicateIndex += 1) {
                        duplicateFootage.push(createProjectIssue(
                            "duplicateFootage",
                            "Duplicate",
                            "warning",
                            "dup",
                            footageByPath[duplicatePath][duplicateIndex],
                            duplicatePath,
                            "footage",
                            String(duplicateIndex)
                        ));
                    }
                }
            }
        }, null);

        cache.projectAudit = {
            fingerprint: fingerprint,
            groups: [
                createIssueGroup("missingFootage", "Missing Footage", missingFootage),
                createIssueGroup("missingFonts", "Missing Fonts", missingFonts),
                createIssueGroup("offlineProxies", "Offline Proxies", offlineProxies),
                createIssueGroup("placeholderFootage", "Placeholder Footage", placeholderFootage),
                createIssueGroup("testAssets", "Color Bars / Test Assets", testAssets),
                createIssueGroup("duplicateFootage", "Duplicate Footage", duplicateFootage),
                createIssueGroup("unusedFootage", "Unused Footage", unusedFootage),
                createIssueGroup("emptyComps", "Empty Compositions", emptyComps),
                createIssueGroup("brokenExpressions", "Missing Expressions", brokenExpressions)
            ]
        };
        cache.projectAuditFingerprint = fingerprint;

        return cache.projectAudit;
    }

    function revealProjectItem(itemId) {
        return safeCall(function () {
            var item = getProjectItemById(itemId);

            if (!item) {
                return false;
            }

            app.project.showWindow(true);

            for (var i = 1; i <= app.project.numItems; i += 1) {
                safeCall(function () {
                    app.project.item(i).selected = false;
                }, null);
            }

            item.selected = true;
            return true;
        }, false);
    }

    function openProjectItem(itemId) {
        return safeCall(function () {
            var item = getProjectItemById(itemId);

            if (!item) {
                return false;
            }

            revealProjectItem(itemId);

            if (isCompItem(item) || isFootageItem(item)) {
                item.openInViewer();
            }

            return true;
        }, false);
    }

    function findLayer(compId, layerIndex) {
        var comp = getCompById(compId) || getActiveComp();
        var index = parseInt(layerIndex, 10);

        if (!comp || !index) {
            return null;
        }

        return {
            comp: comp,
            layer: safeCall(function () { return comp.layer(index); }, null),
            index: index
        };
    }

    function revealLayerInTimeline(comp, layer) {
        comp.openInViewer();

        if (layer.shy === true && comp.hideShyLayers === true) {
            comp.hideShyLayers = false;
        }

        layer.selected = true;
        comp.time = Math.max(comp.displayStartTime, Math.min(layer.inPoint, comp.displayStartTime + comp.duration));
    }

    function revealLayerSource(layer) {
        return safeCall(function () {
            if (!layer.source) {
                return false;
            }

            return revealProjectItem(getItemId(layer.source));
        }, false);
    }

    function titleCase(value) {
        return String(value).replace(/\w\S*/g, function (word) {
            return word.charAt(0).toUpperCase() + word.substr(1).toLowerCase();
        });
    }

    function buildRenameName(originalName, options, sequence) {
        var nextName = String(originalName);
        var search = options.search || "";
        var replace = options.replace || "";

        if (search !== "") {
            if (options.useRegex === true || String(options.useRegex) === "true") {
                nextName = safeCall(function () {
                    return nextName.replace(new RegExp(search, "g"), replace);
                }, nextName);
            } else {
                nextName = nextName.split(search).join(replace);
            }
        }

        if (options.caseMode === "uppercase") {
            nextName = nextName.toUpperCase();
        } else if (options.caseMode === "lowercase") {
            nextName = nextName.toLowerCase();
        } else if (options.caseMode === "title") {
            nextName = titleCase(nextName);
        }

        if (options.prefix) {
            nextName = String(options.prefix) + nextName;
        }

        if (options.suffix) {
            nextName = nextName + String(options.suffix);
        }

        if (sequence > 0) {
            nextName = nextName + " " + sequence;
        }

        return nextName;
    }

    api.refresh = function (includePrecomps) {
        var comp = getActiveComp();
        var includeNested = String(includePrecomps) === "1" || includePrecomps === true;

        if (!comp) {
            cache.compId = "";
            cache.fingerprint = getProjectFingerprint();
            cache.activeLayers = [];
            cache.recursiveLayers = [];
            cache.refreshedAt = "";
            return respond(true, {
                comp: null,
                stats: createEmptyStats(),
                layers: [],
                projectFingerprint: cache.fingerprint,
                refreshedAt: ""
            });
        }

        return respond(true, buildSnapshot(comp, includeNested));
    };

    api.searchLayers = function (query, includePrecomps) {
        var includeNested = String(includePrecomps) === "1" || includePrecomps === true;
        var snapshot = filterLayers(query || "", includeNested);

        if (!snapshot) {
            return api.refresh(includeNested);
        }

        return respond(true, snapshot);
    };

    api.getProjectState = function () {
        var comp = getActiveComp();

        return respond(true, {
            fingerprint: getProjectFingerprint(),
            comp: comp ? getCompositionInfo(comp) : null,
            selectedLayerIds: comp ? getSelectedLayerIds(comp) : []
        });
    };

    api.getStatistics = function () {
        var comp = getActiveComp();

        if (!comp) {
            return respond(true, createEmptyStats());
        }

        return respond(true, collectStats(comp));
    };

    api.getProjectAudit = function () {
        return respond(true, buildProjectAudit());
    };

    api.revealProjectItem = function (itemId) {
        if (!revealProjectItem(itemId)) {
            return respond(false, null, "Unable to reveal project item.");
        }

        return respond(true, buildProjectAudit());
    };

    api.openProjectItem = function (itemId) {
        if (!openProjectItem(itemId)) {
            return respond(false, null, "Unable to open project item.");
        }

        return respond(true, buildProjectAudit());
    };

    api.toggleLayerSelection = function (compId, layerIndex) {
        var comp = getCompById(compId) || getActiveComp();
        var index = parseInt(layerIndex, 10);

        if (!comp || !index) {
            return respond(false, null, "No active composition or invalid layer index.");
        }

        return safeCall(function () {
            var layer = comp.layer(index);
            var shouldSelect = layer.selected !== true;

            comp.openInViewer();

            if (layer.shy === true && comp.hideShyLayers === true) {
                comp.hideShyLayers = false;
            }

            layer.selected = shouldSelect;
            comp.time = Math.max(comp.displayStartTime, Math.min(layer.inPoint, comp.displayStartTime + comp.duration));

            return respond(true, createLayerRecord(layer, index, comp, [safeCall(function () { return comp.name; }, "Composition")]));
        }, respond(false, null, "Unable to select that layer."));
    };

    api.selectLayer = api.toggleLayerSelection;

    api.layerAction = function (action, compId, layerIndex, value) {
        var found = findLayer(compId, layerIndex);
        var undoStarted = false;

        if (!found || !found.layer) {
            return respond(false, null, "Layer not found.");
        }

        return safeCall(function () {
            var layer = found.layer;
            var comp = found.comp;
            var message = "Layer updated.";

            if (action === "revealTimeline") {
                revealLayerInTimeline(comp, layer);
                message = "Revealed in timeline.";
            } else if (action === "revealProject") {
                if (!revealLayerSource(layer)) {
                    return respond(false, null, "Layer has no project source.");
                }
                message = "Revealed in project.";
            } else if (action === "rename") {
                app.beginUndoGroup("EtLayers: Rename Layer");
                undoStarted = true;
                layer.name = String(value || layer.name);
                message = "Renamed layer.";
            } else if (action === "duplicate") {
                app.beginUndoGroup("EtLayers: Duplicate Layer");
                undoStarted = true;
                layer.duplicate();
                message = "Duplicated layer.";
            } else if (action === "delete") {
                app.beginUndoGroup("EtLayers: Delete Layer");
                undoStarted = true;
                layer.remove();
                buildSnapshot(comp, false);
                return respond(true, { layer: null, message: "Deleted layer." });
            } else if (action === "lock") {
                app.beginUndoGroup("EtLayers: Lock Layer");
                undoStarted = true;
                layer.locked = !layer.locked;
                message = layer.locked ? "Locked layer." : "Unlocked layer.";
            } else if (action === "solo") {
                app.beginUndoGroup("EtLayers: Solo Layer");
                undoStarted = true;
                layer.solo = !layer.solo;
                message = layer.solo ? "Soloed layer." : "Unsoloed layer.";
            } else if (action === "shy") {
                app.beginUndoGroup("EtLayers: Shy Layer");
                undoStarted = true;
                layer.shy = !layer.shy;
                message = layer.shy ? "Marked shy." : "Unmarked shy.";
            } else if (action === "label") {
                app.beginUndoGroup("EtLayers: Change Label");
                undoStarted = true;
                layer.label = parseInt(value, 10) || 0;
                message = "Changed label.";
            }

            buildSnapshot(comp, false);
            return respond(true, {
                layer: createLayerRecord(layer, layer.index, comp, [safeCall(function () { return comp.name; }, "Composition")]),
                message: message
            });
        }, respond(false, null, "Layer action failed."));
    };

    api.selectionAction = function (action) {
        var comp = getActiveComp();

        if (!comp) {
            return respond(false, null, "No active composition.");
        }

        return safeCall(function () {
            var selectedLayers = comp.selectedLayers;
            var i;

            if (selectedLayers.length === 0) {
                return respond(false, null, "No selected layers.");
            }

            app.beginUndoGroup("EtLayers: " + action);

            for (i = 0; i < selectedLayers.length; i += 1) {
                if (action === "lockSelected") {
                    selectedLayers[i].locked = true;
                } else if (action === "soloSelected") {
                    selectedLayers[i].solo = true;
                } else if (action === "revealTimeline") {
                    revealLayerInTimeline(comp, selectedLayers[i]);
                }
            }

            app.endUndoGroup();
            buildSnapshot(comp, false);

            return respond(true, {
                applied: selectedLayers.length,
                action: action
            });
        }, respond(false, null, "Selection action failed."));
    };

    api.batchRename = function (optionsJson) {
        var comp = getActiveComp();
        var renamed = 0;
        var total = 0;

        if (!comp) {
            return respond(false, null, "No active composition.");
        }

        return safeCall(function () {
            var options = JSON.parse(optionsJson || "{}");
            var selectedOnly = options.applyTo !== "results";
            var selectedLayers = comp.selectedLayers;
            var ids = {};
            var i;

            if (options.layerIds) {
                for (i = 0; i < options.layerIds.length; i += 1) {
                    ids[String(options.layerIds[i])] = true;
                }
            }

            app.beginUndoGroup("EtLayers: Batch Rename");

            if (selectedOnly) {
                total = selectedLayers.length;
                for (i = 0; i < selectedLayers.length; i += 1) {
                    selectedLayers[i].name = buildRenameName(selectedLayers[i].name, options, options.startNumber ? (parseInt(options.startNumber, 10) + i) : 0);
                    renamed += 1;
                }
            } else {
                for (i = 1; i <= comp.numLayers; i += 1) {
                    var layer = comp.layer(i);
                    var layerId = getCompId(comp) + ":" + i;

                    if (ids[layerId]) {
                        total += 1;
                        layer.name = buildRenameName(layer.name, options, options.startNumber ? (parseInt(options.startNumber, 10) + renamed) : 0);
                        renamed += 1;
                    }
                }
            }

            app.endUndoGroup();
            buildSnapshot(comp, false);

            return respond(true, {
                renamed: renamed,
                total: total
            });
        }, respond(false, null, "Batch rename failed."));
    };

    api.autoLabels = function () {
        var comp = getActiveComp();
        var result = {
            applied: 0,
            skipped: 0,
            total: 0
        };
        var undoStarted = false;

        if (!comp) {
            return respond(false, result, "No active composition.");
        }

        try {
            var layerCount = comp.numLayers;
            var i;

            app.beginUndoGroup("EtLayers: Auto Labels");
            undoStarted = true;
            result.total = layerCount;

            for (i = 1; i <= layerCount; i += 1) {
                var layer = comp.layer(i);
                var labelIndex = getLabelForType(getLayerType(layer));

                if (labelIndex === null) {
                    result.skipped += 1;
                    continue;
                }

                layer.label = labelIndex;
                result.applied += 1;
            }

            buildSnapshot(comp, false);

            return respond(true, result);
        } catch (error) {
            return respond(false, result, "Auto Labels failed.");
        } finally {
            if (undoStarted) {
                safeCall(function () {
                    app.endUndoGroup();
                }, null);
            }
        }
    };
}(EtLayersHost));
