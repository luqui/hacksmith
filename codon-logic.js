var indentStr = "";
function log(s) {
    console.log(indentStr + s);
}
function indent() {
    indentStr += "  ";
}
function outdent() {
    indentStr = indentStr.substr(2);
}



var symid = 0;
function Symbol(name) {
    this.name = name;
    this.id = symid;
    symid += 1;

    this.substitute = function(subs) {
        var r = subs[this.id];
        if (r != null) { return r } else { return this }
    };
    this.freeVars = function(out) {
        out[id] = true;
    };

    this.unify = function(b, vars, subs) {
        if (this == b) return this;

        log("Unify " + this + " = " + b + "  (" + keys(vars).join(",") + ")");
        
        if (vars[this.id]) {
            log(this + " is a variable");
            if (subs[this.id]) {
                log(this + " is substituted for " + subs[this.id]);
                return subs[this.id].unify(b, vars, subs);
            }
            else {
                log(this + " is free");
                subs[this.id] = b;
                return this;
            }
        }
        else {
            log(this + " is a constant");
            if (b instanceof Symbol && vars[b.id]) {
                log(b + " is a variable");
                return b.unify(this, vars, subs);
            }
            else {
                log(b + " is some crap");
                return null;
            }
        }
    };

    this.toString = function() {
        return this.name + "_" + this.id;
    };
}

function Expr(head, arguments) {
    this.head = head;
    this.arguments = arguments;

    this.substitute = function(source, target) {
        return new Expr(this.head, this.arguments.map(function (x) { x.substitute(subs); }));
    };
    this.freeVars = function(out) {
        for (i in arguments) {
            arguments[i].freeVars(out);
        }
    };
    this.unify = function(b, vars, subs) {
        if (b instanceof Symbol) { 
            return b.unify(this, vars, subs); 
        }
        else if (b instanceof Expr) {
            if (b.head == this.head && b.arguments.length == this.arguments.length) {
                var argseq = unifySequence(this.arguments, b.arguments, vars, subs);
                if (argseq == null) { return null; }
                else { return new Expr(head, argseq); }
            }
            else {
                return null;
            }
        }
    };

    this.toString = function() {
        return functionalNotation(this.head, this.arguments);
    };
}

function functionalNotation(head, args) {
    return head.toString() + "(" + args.join(", ") + ")";
}

function unifySequence(seqa, seqb, vars, subs) {
    var unified = [];
    for (var i in seqa) {
        var u = seqa[i].unify(seqb[i], vars, subs);
        if (u == null) { return null; }
        unified[i] = u;
    }
    return unified;
}

function keys(x) {
    var r = [];
    for (var i in x) { r.push(i); }
    return r;
}

function Proposition(head, arguments) {
    this.head = head;
    this.arguments = arguments;

    this.substitute = function(subs) {
        return new Proposition(this.head, this.arguments.map(function (x) { x.substitute(subs) }));
    };

    this.unify = function(b, vars, subs) {
        if (b instanceof Symbol) { 
            log("Swap " + this + " <-> " + b);
            return b.unify(this, vars, subs); 
        }
        else if (b instanceof Proposition) {
            log("Unify " + this + " = " + b + "  (" + keys(vars).join(",") + ")");
            if (b.head == this.head && b.arguments.length == this.arguments.length) {
                var argseq = unifySequence(this.arguments, b.arguments, vars, subs);
                if (argseq == null) { return null; }
                else { return new Expr(head, argseq); }
            }
            else {
                return null;
            }
        }
        else {
            log("No match for " + this + " = " + b);
        }
    };
    

    this.toString = function() {
        return functionalNotation(this.head, this.arguments);
    };
}

function freeVars(x) {
    var ret = {};
    x.freeVars(ret);
    return ret;
};

function arrayToSet(array) {
    var set = {};
    for (var i in array) {
        set[array[i].id] = true;
    }
    return set;
};

function State(head, variables, propositions) {
    this.head = head;
    this.variables = variables;
    this.propositions = propositions;

    this.substates = function(rules) {
        var ret = [];
        log("Finding substates for " + this.toString());
        indent();
        for (var p in this.propositions) {
            var prop = this.propositions[p];
            log("Expanding " + prop.toString());
            indent();
            
            for (var r in rules) {
                var rule = rules[r];
                log("Against " + rule.toString());
                indent();
                
                var newvars = $.extend({}, this.variables);
                
                var subs = {};

                log("vars = " + keys(this.variables).join(","));
                log("newvars = " + keys(newvars).join(","));
                
                var splice = rule.apply(prop, newvars, subs);
                if (splice) {
                    log("Success");
                    for (var i in splice) {
                        splice[i] = splice[i].substitute(subs);
                    }
                    var newstate = this.substitute(newvars, subs);
                    newstate.propositions.splice.apply(newstate.propositions, [p, 1].concat(splice));
                    ret.push(newstate);
                }
                else {
                    log("Fail");
                }
                outdent();
            }
            outdent();
        }
        outdent();
        return ret;
    };

    this.substitute = function(vars, subs) {
        var newprops = [];
        for (var i in this.propositions) {
            newprops[i] = this.propositions[i].substitute(subs);
        }

        var newvars = {};
        for (var i in this.variables) {
            if (!subs[i]) { newvars[i] = true; }
        }
        for (var i in this.vars) {
            if (!subs[i]) { newvars[i] = true; }
        }

        return new State(head.substitute(subs), newvars, newprops);
    };

    this.toString = function() {
        return head + " | {" + keys(this.variables).join(",") + "} " + this.propositions.join("; ");
    };
};

function Rule(variables, lhs, rhs) {
    this.variables = variables;
    this.lhs = lhs;
    this.rhs = rhs;

    this.clone = function(vars) {
        var subs = {};
        for (var i in variables) {
            var v = new Symbol("@");
            subs[i] = v;
            vars[v.id] = true;
        }
        return new Rule([], lhs.substitute(subs), rhs.map(function (x) { x.substitute(subs) }));
    };
    this.apply = function(prop, vars, subs) {
        var newvars = [];
        var clone = this.clone(newvars);

        log("Applying rule " + this);
        log("Variables = " + keys(vars).join(","));

        if (this.lhs.unify(prop, $.extend(vars, newvars), subs)) {
            return clone.rhs;
        }
        else {
            return null;
        }
    };

    this.toString = function() {
        return "{" + keys(this.variables).join(", ") + "} " 
                   + this.lhs.toString() + " <= " + this.rhs.join("; ");
    };
}

