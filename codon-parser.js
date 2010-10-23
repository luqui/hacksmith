
function Nonterminal(x) { 
    this.id = x;
    this.toString = function() { return this.id; };
}

function nonterminal(x) { return new Nonterminal(x); }

function Term(ch) {
    this.term = ch;
    this.toString = function() { return this.term; };
}

function term(x) { return new Term(x); }

function Production() {
    if (arguments.length == 0) { throw("production must have at least one argument"); }
    
    this.lhs = arguments[0];
    this.rhs = Array.prototype.slice.call(arguments, 1);
    this.toString = function() {
        var ret = this.lhs + " -> ";
        for (var i in this.rhs) {
            ret += this.rhs[i] + " ";
        }
        return ret;
    };
}


function DotProduction(p, dot, parents) {   
    this.production = p;
    this.dot = dot;
    this.parents = parents;

    this.predict = function(grammar) {
        var ret = [];
        var nonterm = this.production.rhs[this.dot];
        if (nonterm instanceof Nonterminal) {
            for (var i in grammar) {
                if (grammar[i].lhs == nonterm.id) {
                    ret.push(new DotProduction(grammar[i], 0, [this]));
                }
            }
        }
        return ret;
    };
    this.scan = function(input) {
        var term = this.production.rhs[this.dot];
        if (term instanceof Term) {
            if (term.term == input) {
                return [new DotProduction(this.production, this.dot+1, this.parents)];
            }
        }
        return [];
    };
    this.complete = function() {
        var ret = [];
        if (this.dot == this.production.rhs.length) {
            for (var i in this.parents) {
                var parent = this.parents[i];
                ret.push(new DotProduction(parent.production, parent.dot+1, parent.parents));
            }
        }
        return ret;
    };
    this.equals = function(that) {
        return this.production == that.production && this.dot == that.dot;
    };
    this.toString = function() {
        var ret = this.production.lhs + " -> ";
        for (var i in this.production.rhs) {
            if (i == this.dot) {
                ret += "* ";
            }
            ret += this.production.rhs[i] + " ";
        }
        if (this.dot == this.production.rhs.length) {
            ret += "*";
        }
        return ret;
    };
}

function ParseState() {
    this.dps = [];

    this.contains = function(dp) {
        for (var i in this.dps) {
            if (this.dps[i].equals(dp)) { return this.dps[i]; }
        }
        return null;
    };

    this.add = function(dp) {
        var ex = this.contains(dp);
        if (ex) {
            ex.parents = ex.parents.concat(dp.parents);
        }
        else {
            this.dps.push(dp);
        }
    };
    
    this.addMany = function(dpsin) {
        for (var i in dpsin) { this.add(dpsin[i]); }
    };

    this.fill = function(grammar) {
        var i = 0;
        while (i < this.dps.length) {
            var dp = this.dps[i];
            var sym = dp.production.rhs[dp.dot];
            if (sym instanceof Nonterminal) {
                this.addMany(dp.predict(grammar));
            }
            else if (sym == null) {
                this.addMany(dp.complete());
            }
            i += 1;
        }
    };

    this.nextState = function(grammar, input) {
        var next = new ParseState();
        for (var i in this.dps) {
            var dp = this.dps[i];
            var sym = dp.production.rhs[dp.dot];
            if (sym instanceof Term) {
                next.addMany(dp.scan(input));
            }
        }
        return next;
    };

    this.toString = function() {
        var ret = "";
        for (var i in this.dps) {
            ret += this.dps[i] + "\n";
        }
        return ret;
    };
}
