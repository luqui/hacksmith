$(function () {

var selected = null;

function deselect() {
    if (selected != null) {
        selected.removeClass('selected');
        selected.addClass('deselected')
        selected = null;
    }
}

function select (x) {
    deselect();
    x.addClass('selected');
    x.removeClass('deselected');
    selected = x;
    
    $('#assumptions').empty();
    var ass = x.expr.assumptions();
    for (var i in ass) {
        $('#assumptions').append(ass[i].name);
    }

    $('#history').empty();
    $('#history').append(drawHistory(x.expr));

    $('#actions').empty();
    for (i in x.expr.commands) {
        (function() {
            var cmd = x.expr.commands[i];
            $('#actions').append($('<button/>').append(cmd.description + " (" + i + ")").click(function() {
                cmd.action.call(x.expr, x);
            }));         
        })();
    }
};

function drawHistory (root) {
    var mark = {};

    var structure = {
        expr: root,
        back: [],
        forward: [],
        description: 'You are here',
    };

    var queue = [{ structure: structure, parent: null, side: null }];
    while (queue.length > 0) {
        (function() {
            var elem = queue.shift();
            if (mark[elem.structure.expr.id]) { return; }
            mark[elem.structure.expr.id] = true;

            if (elem.parent != null) {
                elem.parent[elem.side].push(elem.structure);
            }

            var srcmor = srcMorphisms[elem.structure.expr.id];
            for (var i in srcmor) {
                queue.push({ structure: { expr: srcmor[i].target, back: [], forward: [], description: srcmor[i].description }, parent: elem.structure, side: 'forward' });
            }

            var tarmor = targetMorphisms[elem.structure.expr.id];
            for (var i in tarmor) {
                queue.push({ structure: { expr: tarmor[i].src, back: [], forward: [], description: tarmor[i].description }, parent: elem.structure, side: 'back'  });
            }
        })();
    }

    var drawTree = function(tree) {
        var elem = $('<ul/>');
        for (var i in tree.forward) {
            elem.append(drawTree(tree.forward[i]));
        }
        elem.append($('<li/>').append($('<button/>').append(tree.description).click(function() { viewExpr(tree.expr) })));
        for (var i in tree.back) {
            elem.append(drawTree(tree.back[i]));
        }
        return elem;
    };

    return drawTree(structure);
}

function selectable (x) {
    x.click(function(e) {
        select(x);
        e.stopPropagation();
    });
    x.onselectstart = function() { return false; }
    x.draggable({ opacity: 0.7, helper: "clone" });
    return x;
}

function flatMap (xs, f) {
    var ret = [];
    for (var i in xs) {
        ret = ret.concat(f(xs[i]));
    }
    return ret;
}

var srcMorphisms = {};
var targetMorphisms = {};


var idCounter = 0;

function Codon () {
    idCounter += 1;

    this.id = idCounter;    
    
    this.render = function() {
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
    };

    this.findMorphisms = function(gen, morset) {
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
            var newmor = new Morphism(this, newthis, gen.description);
            
            morset[this.id] = newthis;
            return newmor;
        }
    };

    this.renderNewMorphisms = function(ui, mor, morset) {
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
        return newui;
    };
    $.extend(this.commands, globalCommands);
};

var morphismCount = 0;

function Morphism(a,b,desc) {
    this.src = a;
    this.target = b;
    this.description = desc;
    this.id = morphismCount;
    morphismCount += 1;
    if (srcMorphisms[a.id] == null) { srcMorphisms[a.id] = []; }
    srcMorphisms[a.id].push(this);
    if (targetMorphisms[b.id] == null) { targetMorphisms[b.id] = []; }
    targetMorphisms[b.id].push(this);
};

function Apply (x,y) {
    this.children = [x,y];
    this.nice = "(" + x.nice + " " + y.nice + ")";
    this.createUI = function (v) {
        return $('<div class="element deselected"/>').append(
            $('<table/>').append(
                $('<tr/>').append(
                    $('<td/>').append(v(0))).append(
                    $('<td/>').append(v(1)))));
    };
    this.assumptions = function() { 
        return this.children[0].assumptions().concat(this.children[1].assumptions());
    };
        
    this.commands = {
        left: {
            description: "Left child",
            action: function (ui) { select(ui.childUIs[0]) },
        },
        right: {
            description: "Right child",
            action: function (ui) { select(ui.childUIs[1]) },
        },
    };

    this.childsub = function(ch) { return new Apply(ch[0],ch[1]); }

    Codon.apply(this);
};

function Variable (name) {
    this.name = name;
    this.nice = name;
    this.children = [];
    this.createUI = function(v) {
        return $('<div class="element deselected"/>').append(this.name);
    };
    this.assumptions = function() { return [this] };
    this.commands = {
        e: {
            description: "Rename",
            action: function (ui) {
                var input = $('<input/>');
                input.attr('value', this.name);
                var self = this;
                input.keyup(function(e) {
                    e.stopPropagation();
                    if (e.which == 13) {
                        change(new Morphism(self, new Variable(input.attr('value')), "Rename " + self.name + " to " + input.attr('value')));
                    }
                });
                ui.empty();
                ui.append(input);
                input.focus();
            },
        },
    };
    this.childsub = function(ch) { error("Impossible: no children"); }

    Codon.apply(this);
};

function Substitution(free, arg, body) {
    this.children = [ free, arg, body ];
    this.nice = "(" + free.nice + "=" + arg.nice + " in " + body.nice + ")";
    this.createUI = function (v) {
        return $('<div class="element deselected" style="border: double"/>').append(
            $('<table/>').append(
                $('<tr/>').append(
                    $('<td/>').append(v(0)).append("=").append(v(1)))).append(
                $('<tr/>').append(
                    $('<td/>').append(v(2)))))
    };
    this.assumptions = function() { 
        var self = this;
        return flatMap(body.assumptions(), function(x) {
            if (x == self.children[0]) {
                return self.children[1].assumptions();
            }
            else {
                return [x];
            }
        }) 
    };
    
    this.commands = {
        right: {
            description: "Argument",
            action: function(ui) {
                select(ui.childUIs[1]);
            },
        },
        left: {
            description: "Parameter",
            action: function(ui) {
                select(ui.childUIs[0]);
            },
        },
        down: {
            description: "Body",
            action: function(ui) {
                select(ui.childUIs[2]);
            },
        },
    };

    this.childsub = function(ch) { return new Substitution(ch[0], ch[1], ch[2]) };

    Codon.apply(this);
};

var globalCommands = {
    up: {
        description: "Parent",
        action: function (ui) {
            if (ui.parentUI) {
                select(ui.parentUI);
            }
        },
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
                cmds[code].action.call(selected.expr, selected);
            }
        }
    }
});

document.onselectstart = function(e) { return false; }

var xvar = new Variable("x");
var zvar = new Variable("z");
var ds;
var dsui;

var change = function(mor) {
    var set = {};
    ds.findMorphisms(mor, set);
    dsui = ds.renderNewMorphisms(dsui, mor, set);
    ds = dsui.expr;
    $('#content').html(dsui);
};

var viewExpr = function(expr) {
    ds = expr;
    dsui = ds.render();
    $('#content').html(dsui);
    select(dsui);
};

viewExpr(new Apply(new Substitution(zvar, new Variable("w"), new Apply(xvar, zvar)), new Apply(xvar, zvar)));

});
