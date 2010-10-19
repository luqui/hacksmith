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
        $('#assumptions').append(makeUI(varref(ass[i])));
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

var apply = function (x,y) {
    var outer;
    outer = {
        children: [x,y],
        render: function (v) {
            return $('<div class="element deselected"/>').append(
                $('<table/>').append(
                    $('<tr/>').append(
                        $('<td/>').append(v(0))).append(
                        $('<td/>').append(v(1)))));
        },
        assumptions: function() { return outer.children[0].assumptions().concat(outer.children[1].assumptions()) },
        
        commands: {
            left: function (ui) { select(ui.children[0]) },
            right: function (ui) { select(ui.children[1]) },
        },
    };
    return outer;
};

var varref = function (ref) {
    var outer;
    outer = {
        children: [],
        render: function(v) {
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
        },
    };
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
    outer = {
        free: free,
        children: [ arg, body ],
        render: function (v) {
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
            down: function() {
                select(outer.children[1].ui);
            },
        },
    };
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

var makeUI = function (x) {
    var ui = x.render(function (e) {
        var r = makeUI(x.children[e]);
        e.parent = x;
        return r;
    });

    ui.expr = x;
    selectable(ui);

    return ui;
};

var globalCommands = {
    up: function (expr) {
        if (expr.parent) {
            select(expr.parent.ui);
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
                cmds[code]();
            }
            else if (globalCommands[code]) {
                globalCommands[code](selected.expr);
            }
        }
    }
});

document.onselectstart = function(e) { return false; }

var xvar = variable("x");
var ds = apply(substitution("z",solovar("w"),apply(varref(xvar), solovar("z"))), varref(xvar));

var refresh = function() {
    $('#content').html(makeUI(ds));
};

refresh();

});
