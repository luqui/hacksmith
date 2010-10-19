$(function () {

var selected = null;

var deselect = function () {
    if (selected != null) {
        selected.removeClass('selected');
        selected.addClass('deselected')
        selected = null;
    }
};

var select = function (x) {
    deselect();
    x.addClass('selected');
    x.removeClass('deselected');
    selected = x;
    
    $('#assumptions').empty();
    var ass = x.expr.assumptions();
    for (var i in ass) {
        $('#assumptions').append(ass[i].name);
    }

    $('#history_redo').empty();
    for (var i in srcMorphisms[x.expr.id]) {
        (function () {
            var mor = srcMorphisms[x.expr.id][i];
            $('#history_redo').append(
                $('<button/>').append(mor.description + "(" + mor.id + ")").click(function(e) {
                    change(mor);
                }));
        })();
    }
    $('#history_undo').empty();
    for (var i in targetMorphisms[x.expr.id]) { 
        (function () {
            var mor = targetMorphisms[x.expr.id][i];
            $('#history_undo').append(
                $('<button/>').append(mor.description + "(" + mor.id + ")").click(function(e) {
                    change(Morphism(mor.target, mor.src, "Undo [" + mor.description + "(" + mor.id + ")]"));
                }));
        })();
    }

    console.log("Selected ", x);
};

var selectable = function (x) {
    x.click(function(e) {
        select(x);
        e.stopPropagation();
    });
    x.onselectstart = function() { return false; }
    x.draggable({ opacity: 0.7, helper: "clone" });
    return x;
};

var flatMap = function(xs, f) {
    var ret = [];
    for (var i in xs) {
        ret = ret.concat(f(xs[i]));
    }
    return ret;
};

var incorporate = function(into, xs) {
    for (var i in xs) { into[i] = xs[i] }
    return into;
};


var srcMorphisms = {};
var targetMorphisms = {};


var idCounter = 0;

var Codon = function(xs) {
    idCounter += 1;
    return incorporate({
        id: idCounter,
        render: function() {
            var chuis = [];
            var self = this;
            var ui = self.createUI(function (i) {
                return chuis[i] = self.children[i].render();
            });
            ui.childUIs = chuis;
            for (var i in chuis) {
                chuis[i].parentUI = ui;
            }
            selectable(ui);
            ui.expr = self;
            return ui;
        },

        findMorphisms: function(gen, morset) {
            if (this == gen.src) {
                morset[this.id] = gen.target;
                return gen; 
            }

            var newchildren = [];
            var seen = false;
            for (var i in this.children) {
                var mor = this.children[i].findMorphisms(gen, morset);
                if (mor != null) {
                    seen = true;
                    newchildren[i] = mor.target;
                }
                else {
                    newchildren[i] = this.children[i];
                }
            }
            if (seen) {
                var newthis = this.childsub(newchildren);
                var newmor = Morphism(this, newthis, gen.description);
                
                morset[this.id] = newthis;
                return newmor;
            }
        },

        renderNewMorphisms: function(ui, mor, morset) {
            if (morset[this.id] == null) {
                return ui; 
            }
            
            var chuis = [];
            var self = this;
            var newui;
            if (this == mor.src) {
                newui = morset[this.id].render();
            }
            else {
                newui = morset[this.id].createUI(function (i) {
                    return chuis[i] = self.children[i].renderNewMorphisms(ui.childUIs[i], mor, morset);
                });
                newui.childUIs = chuis;
                for (var i in chuis) {
                    chuis[i].parentUI = newui;
                }
                selectable(newui);
                newui.expr = morset[this.id];
            };
            if (ui == selected) { console.log("New selection"); select(newui); }
            return newui;
        },
    }, xs);
};

var morphismCount = 0;

var Morphism = function(a,b,desc) {
    var mor = { src: a, target: b, description: desc, id: morphismCount };
    morphismCount += 1;
    if (srcMorphisms[a.id] == null) { srcMorphisms[a.id] = []; }
    srcMorphisms[a.id].push(mor);
    if (targetMorphisms[b.id] == null) { targetMorphisms[b.id] = []; }
    targetMorphisms[b.id].push(mor);
    return mor;
};

var apply = function (x,y) {
    var outer;
    outer = new Codon({
        children: [x,y],
        nice: "(" + x.nice + " " + y.nice + ")",
        createUI: function (v) {
            return $('<div class="element deselected"/>').append(
                $('<table/>').append(
                    $('<tr/>').append(
                        $('<td/>').append(v(0))).append(
                        $('<td/>').append(v(1)))));
        },
        assumptions: function() { 
            return outer.children[0].assumptions().concat(outer.children[1].assumptions());
        },
        
        commands: {
            left: function (ui) { select(ui.childUIs[0]) },
            right: function (ui) { select(ui.childUIs[1]) },
        },

        childsub: function(ch) { return apply(ch[0],ch[1]); }
    });
    return outer;
};

var variable = function (name) {
    var outer;
    outer = new Codon({
        name: name,
        nice: name,
        children: [],
        createUI: function(v) {
            return $('<div class="element deselected"/>').append(outer.name);
        },
        assumptions: function() { return [this] },

        commands: {
            e: function (ui) {
                var input = $('<input/>');
                input.attr('value', outer.name);
                var self = this;
                input.keyup(function(e) {
                    e.stopPropagation();
                    if (e.which == 13) {
                        change(Morphism(self, variable(input.attr('value')), "Rename " + outer.name + " to " + input.attr('value')));
                    }
                });
                ui.empty();
                ui.append(input);
                input.focus();
            },
        },

        childsub: function(ch) { error("Impossible: no children"); }
    });
    return outer;
};

var substitution = function (free, arg, body) {
    var outer; 
    outer = new Codon({
        children: [ free, arg, body ],
        nice: "(" + free.nice + "=" + arg.nice + " in " + body.nice + ")",
        createUI: function (v) {
            return $('<div class="element deselected" style="border: double"/>').append(
                $('<table/>').append(
                    $('<tr/>').append(
                        $('<td/>').append(v(0)).append("=").append(v(1)))).append(
                    $('<tr/>').append(
                        $('<td/>').append(v(2)))))
        },
        assumptions: function() { 
            return flatMap(body.assumptions(), function(x) {
                if (x == outer.children[0]) {
                    return outer.children[1].assumptions();
                }
                else {
                    return [x];
                }
            }) 
        },
        
        commands: {
            left: function(ui) {
                select(ui.childUIs[1]);
            },
            down: function(ui) {
                select(ui.childUIs[2]);
            },
        },

        childsub: function(ch) { return substitution(ch[0], ch[1], ch[2]); }
    });
    return outer;
};

var globalCommands = {
    up: function (ui) {
        if (ui.parentUI) {
            select(ui.parentUI);
        }
    },
}

var keycodes = {
    65: 'a',
    70: 'f',
    69: 'e',
    83: 's',
    8: 'backspace',
    37: 'left',
    38: 'up',
    39: 'right',
    40: 'down',
};

$(document).keyup(function(e) {
    console.log("Key " + e.which);
    if (selected != null) {
        var code = keycodes[e.which];
        var cmds = selected.expr.commands;
        if (code) {
            if (cmds && cmds[code]) {
                cmds[code].call(selected.expr, selected);
            }
            else if (globalCommands[code]) {
                globalCommands[code](selected);
            }
        }
    }
});

document.onselectstart = function(e) { return false; }

var xvar = variable("x");
var zvar = variable("z");
var ds = apply(substitution(zvar,variable("w"),apply(xvar, zvar)), apply(xvar, zvar));
var dsui;

var refresh = function() {
    dsui = ds.render();
    $('#content').html(dsui);
};
refresh();

var change = function(mor) {
    var set = {};
    ds.findMorphisms(mor, set);
    dsui = ds.renderNewMorphisms(dsui, mor, set);
    ds = dsui.expr;
    $('#content').html(dsui);
};

});
