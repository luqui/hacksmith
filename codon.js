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

var Codon = function(xs) {
    return incorporate({
        render: function() {
            var chuis = [];
            var self = this;
            var ui = self.createUI(function (i) {
                return chuis[i] = self.children[i].render();
            });
            ui.childUIs = [];
            for (var i in chuis) {
                chuis[i].parentUI = ui;
                ui.childUIs[i] = chuis[i];
            }
            selectable(ui);
            ui.expr = self;
            return ui;
        },
    }, xs);
};

var Morphism = function(a,b,desc) {
    return { src: a, target: b, description: desc };
};

var apply = function (x,y) {
    var outer;
    outer = new Codon({
        children: [x,y],
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
    });
    return outer;
};

var varref = function (ref) {
    var outer;
    outer = new Codon({
        children: [],
        createUI: function(v) {
            return $('<div class="element deselected"/>').append(ref.name);
        },
        assumptions: function() { return [ref] },

        commands: {
            e: function () {
                deselect();
                var input = $('<input/>');
                input.attr('value', ref.name);
                input.keypress(function(e) {
                    if (e.which == 13) {
                        ref.name = input.attr('value');
                        refresh();
                        select(outer.ui);
                    }
                });
                input.focus();
                outer.ui.replaceWith(input);
            },
        }
    });
    return outer;
};

var variable = function (name) {
    return {
        name: name,
    };
};

var solovar = function (name) {
    return varref(variable(name));
};

var substitution = function (free, arg, body) {
    var outer; 
    outer = new Codon({
        free: free,
        children: [ arg, body ],
        createUI: function (v) {
            return $('<div class="element deselected" style="border: double"/>').append(
                $('<table/>').append(
                    $('<tr/>').append(
                        $('<td/>').append(free + "=").append(v(0)))).append(
                    $('<tr/>').append(
                        $('<td/>').append(v(1)))))
        },
        assumptions: function() { 
            return flatMap(body.assumptions(), function(x) {
                if (x == outer.free) {
                    return outer.children[0].assumptions();
                }
                else {
                    return [x];
                }
            }) 
        },
        
        commands: {
            left: function(ui) {
                select(ui.childUIs[0]);
            },
            down: function(ui) {
                select(ui.childUIs[1]);
            },
        },
    });
    return outer;
};

var replace = function (src, target) {
    var p = src.parent;
    if (p) {
        for (var i in p) {
            if (p[i] == src) {
                p[i] = target;
            }
        }
    }
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

$(document).keydown(function(e) {
    console.log("Key " + e.which);
    if (selected != null) {
        var code = keycodes[e.which];
        var cmds = selected.expr.commands;
        if (code) {
            if (cmds && cmds[code]) {
                cmds[code](selected);
            }
            else if (globalCommands[code]) {
                globalCommands[code](selected);
            }
        }
    }
});

document.onselectstart = function(e) { return false; }

var xvar = variable("x");
var ds = apply(substitution("z",solovar("w"),apply(varref(xvar), solovar("z"))), varref(xvar));

var refresh = function() {
    $('#content').html(ds.render());
};

refresh();

});
