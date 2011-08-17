(function() {
  var Parser, alt, alternatives, grammar, name, o, operators, token, tokens, unwrap;
  Parser = require('jison').Parser;
  unwrap = /^function\s*\(\)\s*\{\s*return\s*([\s\S]*);\s*\}/;
  o = function(patternString, action, options) {
    var match;
    patternString = patternString.replace(/\s{2,}/g, ' ');
    if (!action) {
      return [patternString, '$$ = $1;', options];
    }
    action = (match = unwrap.exec(action)) ? match[1] : "(" + action + ".call(this))";
    action = action.replace(/\bnew /g, '$&yy.');
    action = action.replace(/\b(?:Block\.wrap|extend)\b/g, 'yy.$&');
    action = action.replace(/(this\.\$)/g, '@');
    return [patternString, "$$ = " + action + ";", options];
  };
  grammar = {
    Root: [
      o('', function() {
        return new Block(this.$$.first_line, this.$$.first_column, []);
      }), o('Body'), o('Block TERMINATOR')
    ],
    Body: [
      o('Line', function() {
        return Block.wrap([$1], this.$$.first_line, this.$$.first_column);
      }), o('Body TERMINATOR Line', function() {
        return $1.push($3);
      }), o('Body TERMINATOR')
    ],
    Line: [o('Expression'), o('Statement')],
    Statement: [
      o('Return'), o('Throw'), o('Comment'), o('STATEMENT', function() {
        return new Literal(this.$$.first_line, this.$$.first_column, $1);
      })
    ],
    Expression: [o('Value'), o('Invocation'), o('Code'), o('Operation'), o('Assign'), o('If'), o('Try'), o('While'), o('For'), o('Switch'), o('Class')],
    Block: [
      o('INDENT OUTDENT', function() {
        return new Block(this.$$.first_line, this.$$.first_column, []);
      }), o('INDENT Body OUTDENT', function() {
        return $2;
      })
    ],
    Identifier: [
      o('IDENTIFIER', function() {
        return new Literal(this.$$.first_line, this.$$.first_column, $1);
      })
    ],
    AlphaNumeric: [
      o('NUMBER', function() {
        return new Literal(this.$$.first_line, this.$$.first_column, $1);
      }), o('STRING', function() {
        return new Literal(this.$$.first_line, this.$$.first_column, $1);
      })
    ],
    Literal: [
      o('AlphaNumeric'), o('JS', function() {
        return new Literal(this.$$.first_line, this.$$.first_column, $1);
      }), o('REGEX', function() {
        return new Literal(this.$$.first_line, this.$$.first_column, $1);
      }), o('BOOL', function() {
        var val;
        val = new Literal(this.$$.first_line, this.$$.first_column, $1);
        if ($1 === 'undefined') {
          val.isUndefined = true;
        }
        return val;
      })
    ],
    Assign: [
      o('Assignable = Expression', function() {
        return new Assign(this.$$.first_line, this.$$.first_column, $1, $3);
      }), o('Assignable = INDENT Expression OUTDENT', function() {
        return new Assign(this.$$.first_line, this.$$.first_column, $1, $4);
      })
    ],
    AssignObj: [
      o('ObjAssignable', function() {
        return new Value(this.$$.first_line, this.$$.first_column, $1);
      }), o('ObjAssignable : Expression', function() {
        return new Assign(this.$2.first_line, this.$2.first_column, new Value(this.$1.first_line, this.$1.first_column, $1), $3, 'object');
      }), o('ObjAssignable :\
       INDENT Expression OUTDENT', function() {
        return new Assign(this.$2.first_line, this.$2.first_column, new Value(this.$1.first_line, this.$1.first_column, $1), $4, 'object');
      }), o('Comment')
    ],
    ObjAssignable: [o('Identifier'), o('AlphaNumeric'), o('ThisProperty')],
    Return: [
      o('RETURN Expression', function() {
        return new Return(this.$1.first_line, this.$1.first_column, $2);
      }), o('RETURN', function() {
        return new Return(this.$1.first_line, this.$1.first_column);
      })
    ],
    Comment: [
      o('HERECOMMENT', function() {
        return new Comment($1);
      })
    ],
    Code: [
      o('PARAM_START ParamList PARAM_END FuncGlyph Block', function() {
        return new Code(this.$1.first_line, this.$1.first_column, $2, $5, $4);
      }), o('FuncGlyph Block', function() {
        return new Code(this.$1.first_line, this.$1.first_column, [], $2, $1);
      })
    ],
    FuncGlyph: [
      o('->', function() {
        return 'func';
      }), o('=>', function() {
        return 'boundfunc';
      })
    ],
    OptComma: [o(''), o(',')],
    ParamList: [
      o('', function() {
        return [];
      }), o('Param', function() {
        return [$1];
      }), o('ParamList , Param', function() {
        return $1.concat($3);
      })
    ],
    Param: [
      o('ParamVar', function() {
        return new Param(this.$1.first_line, this.$1.first_column, $1, void 0, void 0);
      }), o('ParamVar ...', function() {
        return new Param(this.$1.first_line, this.$1.first_column, $1, null, true);
      }), o('ParamVar = Expression', function() {
        return new Param(this.$1.first_line, this.$1.first_column, $1, $3, void 0);
      })
    ],
    ParamVar: [o('Identifier'), o('ThisProperty'), o('Array'), o('Object')],
    Splat: [
      o('Expression ...', function() {
        return new Splat(this.$1.first_line, this.$1.first_column, $1);
      })
    ],
    SimpleAssignable: [
      o('Identifier', function() {
        return new Value(this.$1.first_line, this.$1.first_column, $1, void 0, void 0);
      }), o('Value Accessor', function() {
        return $1.add($2);
      }), o('Invocation Accessor', function() {
        return new Value(this.$1.first_line, this.$1.first_column, $1, [$2], void 0);
      }), o('ThisProperty')
    ],
    Assignable: [
      o('SimpleAssignable'), o('Array', function() {
        return new Value(this.$1.first_line, this.$1.first_column, $1, void 0, void 0);
      }), o('Object', function() {
        return new Value(this.$1.first_line, this.$1.first_column, $1, void 0, void 0);
      })
    ],
    Value: [
      o('Assignable'), o('Literal', function() {
        return new Value(this.$1.first_line, this.$1.first_column, $1, void 0, void 0);
      }), o('Parenthetical', function() {
        return new Value(this.$1.first_line, this.$1.first_column, $1, void 0, void 0);
      }), o('Range', function() {
        return new Value(this.$1.first_line, this.$1.first_column, $1, void 0, void 0);
      }), o('This')
    ],
    Accessor: [
      o('.  Identifier', function() {
        return new Access(this.$1.first_line, this.$1.first_column, $2);
      }), o('?. Identifier', function() {
        return new Access(this.$1.first_line, this.$1.first_column, $2, 'soak');
      }), o(':: Identifier', function() {
        return [new Access(this.$$.first_line, this.$$.first_column, new Literal(this.$1.first_line, this.$1.first_column, 'prototype')), new Access(this.$2.first_line, this.$2.first_column, $2)];
      }), o('::', function() {
        return new Access(this.$1.first_line, this.$1.first_column, new Literal(this.$1.first_line, this.$1.first_column, 'prototype'));
      }), o('Index')
    ],
    Index: [
      o('INDEX_START IndexValue INDEX_END', function() {
        return $2;
      }), o('INDEX_SOAK  Index', function() {
        return extend($2, {
          soak: true
        });
      })
    ],
    IndexValue: [
      o('Expression', function() {
        return new Index(this.$1.first_line, this.$1.first_column, $1);
      }), o('Slice', function() {
        return new Slice(this.$1.first_line, this.$1.first_column, $1);
      })
    ],
    Object: [
      o('{ AssignList OptComma }', function() {
        return new Obj(this.$1.first_line, this.$1.first_column, $2, $1.generated);
      })
    ],
    AssignList: [
      o('', function() {
        return [];
      }), o('AssignObj', function() {
        return [$1];
      }), o('AssignList , AssignObj', function() {
        return $1.concat($3);
      }), o('AssignList OptComma TERMINATOR AssignObj', function() {
        return $1.concat($4);
      }), o('AssignList OptComma INDENT AssignList OptComma OUTDENT', function() {
        return $1.concat($4);
      })
    ],
    Class: [
      o('CLASS', function() {
        return new Class(this.$1.first_line, this.$1.first_column);
      }), o('CLASS Block', function() {
        return new Class(this.$1.first_line, this.$1.first_column, null, null, $2);
      }), o('CLASS EXTENDS Expression', function() {
        return new Class(this.$1.first_line, this.$1.first_column, null, $3);
      }), o('CLASS EXTENDS Expression Block', function() {
        return new Class(this.$1.first_line, this.$1.first_column, null, $3, $4);
      }), o('CLASS SimpleAssignable', function() {
        return new Class(this.$1.first_line, this.$1.first_column, $2);
      }), o('CLASS SimpleAssignable Block', function() {
        return new Class(this.$1.first_line, this.$1.first_column, $2, null, $3);
      }), o('CLASS SimpleAssignable EXTENDS Expression', function() {
        return new Class(this.$1.first_line, this.$1.first_column, $2, $4);
      }), o('CLASS SimpleAssignable EXTENDS Expression Block', function() {
        return new Class(this.$1.first_line, this.$1.first_column, $2, $4, $5);
      })
    ],
    Invocation: [
      o('Value OptFuncExist Arguments', function() {
        return new Call(this.$$.first_line, this.$$.first_column, $1, $3, $2);
      }), o('Invocation OptFuncExist Arguments', function() {
        return new Call(this.$$.first_line, this.$$.first_column, $1, $3, $2);
      }), o('SUPER', function() {
        return new Call(this.$$.first_line, this.$$.first_column, 'super', [new Splat(this.$$.first_line, this.$$.first_column, new Literal(this.$$.first_line, this.$$.first_column, 'arguments'))]);
      }), o('SUPER Arguments', function() {
        return new Call(this.$$.first_line, this.$$.first_column, 'super', $2);
      })
    ],
    OptFuncExist: [
      o('', function() {
        return false;
      }), o('FUNC_EXIST', function() {
        return true;
      })
    ],
    Arguments: [
      o('CALL_START CALL_END', function() {
        return [];
      }), o('CALL_START ArgList OptComma CALL_END', function() {
        return $2;
      })
    ],
    This: [
      o('THIS', function() {
        return new Value(this.$$.first_line, this.$$.first_column, new Literal(this.$$.first_line, this.$$.first_column, 'this'));
      }), o('@', function() {
        return new Value(this.$$.first_line, this.$$.first_column, new Literal(this.$$.first_line, this.$$.first_column, 'this'));
      })
    ],
    ThisProperty: [
      o('@ Identifier', function() {
        return new Value(this.$$.first_line, this.$$.first_column, new Literal(this.$1.first_line, this.$1.first_column, 'this'), [new Access(this.$2.first_line, this.$2.first_column, $2)], 'this');
      })
    ],
    Array: [
      o('[ ]', function() {
        return new Arr(this.$$.first_line, this.$$.first_column, []);
      }), o('[ ArgList OptComma ]', function() {
        return new Arr(this.$$.first_line, this.$$.first_column, $2);
      })
    ],
    RangeDots: [
      o('..', function() {
        return 'inclusive';
      }), o('...', function() {
        return 'exclusive';
      })
    ],
    Range: [
      o('[ Expression RangeDots Expression ]', function() {
        return new Range(this.$$.first_line, this.$$.first_column, $2, $4, $3);
      })
    ],
    Slice: [
      o('Expression RangeDots Expression', function() {
        return new Range(this.$$.first_line, this.$$.first_column, $1, $3, $2);
      }), o('Expression RangeDots', function() {
        return new Range(this.$$.first_line, this.$$.first_column, $1, null, $2);
      }), o('RangeDots Expression', function() {
        return new Range(this.$$.first_line, this.$$.first_column, null, $2, $1);
      })
    ],
    ArgList: [
      o('Arg', function() {
        return [$1];
      }), o('ArgList , Arg', function() {
        return $1.concat($3);
      }), o('ArgList OptComma TERMINATOR Arg', function() {
        return $1.concat($4);
      }), o('INDENT ArgList OptComma OUTDENT', function() {
        return $2;
      }), o('ArgList OptComma INDENT ArgList OptComma OUTDENT', function() {
        return $1.concat($4);
      })
    ],
    Arg: [o('Expression'), o('Splat')],
    SimpleArgs: [
      o('Expression'), o('SimpleArgs , Expression', function() {
        return [].concat($1, $3);
      })
    ],
    Try: [
      o('TRY Block', function() {
        return new Try(this.$$.first_line, this.$$.first_column, $2);
      }), o('TRY Block Catch', function() {
        return new Try(this.$$.first_line, this.$$.first_column, $2, $3[0], $3[1]);
      }), o('TRY Block FINALLY Block', function() {
        return new Try(this.$$.first_line, this.$$.first_column, $2, null, null, $4);
      }), o('TRY Block Catch FINALLY Block', function() {
        return new Try(this.$$.first_line, this.$$.first_column, $2, $3[0], $3[1], $5);
      })
    ],
    Catch: [
      o('CATCH Identifier Block', function() {
        return [$2, $3];
      })
    ],
    Throw: [
      o('THROW Expression', function() {
        return new Throw(this.$$.first_line, this.$$.first_column, $2);
      })
    ],
    Parenthetical: [
      o('( Body )', function() {
        return new Parens(this.$$.first_line, this.$$.first_column, $2);
      }), o('( INDENT Body OUTDENT )', function() {
        return new Parens(this.$$.first_line, this.$$.first_column, $3);
      })
    ],
    WhileSource: [
      o('WHILE Expression', function() {
        return new While(this.$$.first_line, this.$$.first_column, $2);
      }), o('WHILE Expression WHEN Expression', function() {
        return new While(this.$$.first_line, this.$$.first_column, $2, {
          guard: $4
        });
      }), o('UNTIL Expression', function() {
        return new While(this.$$.first_line, this.$$.first_column, $2, {
          invert: true
        });
      }), o('UNTIL Expression WHEN Expression', function() {
        return new While(this.$$.first_line, this.$$.first_column, $2, {
          invert: true,
          guard: $4
        });
      })
    ],
    While: [
      o('WhileSource Block', function() {
        return $1.addBody($2);
      }), o('Statement  WhileSource', function() {
        return $2.addBody(Block.wrap([$1], this.$$.first_line, this.$$.first_column));
      }), o('Expression WhileSource', function() {
        return $2.addBody(Block.wrap([$1], this.$$.first_line, this.$$.first_column));
      }), o('Loop', function() {
        return $1;
      })
    ],
    Loop: [
      o('LOOP Block', function() {
        return new While(this.$$.first_line, this.$$.first_column, new Literal(this.$$.first_line, this.$$.first_column, 'true')).addBody($2);
      }), o('LOOP Expression', function() {
        return new While(this.$$.first_line, this.$$.first_column, new Literal(this.$$.first_line, this.$$.first_column, 'true')).addBody(Block.wrap([$2], this.$$.first_line, this.$$.first_column));
      })
    ],
    For: [
      o('Statement  ForBody', function() {
        return new For(this.$$.first_line, this.$$.first_column, $1, $2);
      }), o('Expression ForBody', function() {
        return new For(this.$$.first_line, this.$$.first_column, $1, $2);
      }), o('ForBody    Block', function() {
        return new For(this.$$.first_line, this.$$.first_column, $2, $1);
      })
    ],
    ForBody: [
      o('FOR Range', function() {
        return {
          source: new Value(this.$$.first_line, this.$$.first_column, $2)
        };
      }), o('ForStart ForSource', function() {
        $2.own = $1.own;
        $2.name = $1[0];
        $2.index = $1[1];
        return $2;
      })
    ],
    ForStart: [
      o('FOR ForVariables', function() {
        return $2;
      }), o('FOR OWN ForVariables', function() {
        $3.own = true;
        return $3;
      })
    ],
    ForValue: [
      o('Identifier'), o('Array', function() {
        return new Value(this.$$.first_line, this.$$.first_column, $1);
      }), o('Object', function() {
        return new Value(this.$$.first_line, this.$$.first_column, $1);
      })
    ],
    ForVariables: [
      o('ForValue', function() {
        return [$1];
      }), o('ForValue , ForValue', function() {
        return [$1, $3];
      })
    ],
    ForSource: [
      o('FORIN Expression', function() {
        return {
          source: $2
        };
      }), o('FOROF Expression', function() {
        return {
          source: $2,
          object: true
        };
      }), o('FORIN Expression WHEN Expression', function() {
        return {
          source: $2,
          guard: $4
        };
      }), o('FOROF Expression WHEN Expression', function() {
        return {
          source: $2,
          guard: $4,
          object: true
        };
      }), o('FORIN Expression BY Expression', function() {
        return {
          source: $2,
          step: $4
        };
      }), o('FORIN Expression WHEN Expression BY Expression', function() {
        return {
          source: $2,
          guard: $4,
          step: $6
        };
      }), o('FORIN Expression BY Expression WHEN Expression', function() {
        return {
          source: $2,
          step: $4,
          guard: $6
        };
      })
    ],
    Switch: [
      o('SWITCH Expression INDENT Whens OUTDENT', function() {
        return new Switch(this.$$.first_line, this.$$.first_column, $2, $4);
      }), o('SWITCH Expression INDENT Whens ELSE Block OUTDENT', function() {
        return new Switch(this.$$.first_line, this.$$.first_column, $2, $4, $6);
      }), o('SWITCH INDENT Whens OUTDENT', function() {
        return new Switch(this.$$.first_line, this.$$.first_column, null, $3);
      }), o('SWITCH INDENT Whens ELSE Block OUTDENT', function() {
        return new Switch(this.$$.first_line, this.$$.first_column, null, $3, $5);
      })
    ],
    Whens: [
      o('When'), o('Whens When', function() {
        return $1.concat($2);
      })
    ],
    When: [
      o('LEADING_WHEN SimpleArgs Block', function() {
        return [[$2, $3]];
      }), o('LEADING_WHEN SimpleArgs Block TERMINATOR', function() {
        return [[$2, $3]];
      })
    ],
    IfBlock: [
      o('IF Expression Block', function() {
        return new If(this.$$.first_line, this.$$.first_column, $2, $3, {
          type: $1
        });
      }), o('IfBlock ELSE IF Expression Block', function() {
        return $1.addElse(new If(this.$$.first_line, this.$$.first_column, $4, $5, {
          type: $3
        }));
      })
    ],
    If: [
      o('IfBlock'), o('IfBlock ELSE Block', function() {
        return $1.addElse($3);
      }), o('Statement  POST_IF Expression', function() {
        return new If(this.$$.first_line, this.$$.first_column, $3, Block.wrap([$1], this.$$.first_line, this.$$.first_column), {
          type: $2,
          statement: true
        });
      }), o('Expression POST_IF Expression', function() {
        return new If(this.$$.first_line, this.$$.first_column, $3, Block.wrap([$1], this.$$.first_line, this.$$.first_column), {
          type: $2,
          statement: true
        });
      })
    ],
    Operation: [
      o('UNARY Expression', function() {
        return new Op(this.$1.first_line, this.$1.first_column, $1, $2);
      }), o('-     Expression', (function() {
        return new Op(this.$1.first_line, this.$1.first_column, '-', $2);
      }), {
        prec: 'UNARY'
      }), o('+     Expression', (function() {
        return new Op(this.$1.first_line, this.$1.first_column, '+', $2);
      }), {
        prec: 'UNARY'
      }), o('-- SimpleAssignable', function() {
        return new Op(this.$1.first_line, this.$1.first_column, '--', $2);
      }), o('++ SimpleAssignable', function() {
        return new Op(this.$1.first_line, this.$1.first_column, '++', $2);
      }), o('SimpleAssignable --', function() {
        return new Op(this.$2.first_line, this.$2.first_column, '--', $1, null, true);
      }), o('SimpleAssignable ++', function() {
        return new Op(this.$2.first_line, this.$2.first_column, '++', $1, null, true);
      }), o('Expression ?', function() {
        return new Existence(this.$2.first_line, this.$2.first_column, $1);
      }), o('Expression +  Expression', function() {
        return new Op(this.$2.first_line, this.$2.first_column, '+', $1, $3);
      }), o('Expression -  Expression', function() {
        return new Op(this.$2.first_line, this.$2.first_column, '-', $1, $3);
      }), o('Expression MATH     Expression', function() {
        return new Op(this.$2.first_line, this.$2.first_column, $2, $1, $3);
      }), o('Expression SHIFT    Expression', function() {
        return new Op(this.$2.first_line, this.$2.first_column, $2, $1, $3);
      }), o('Expression COMPARE  Expression', function() {
        return new Op(this.$2.first_line, this.$2.first_column, $2, $1, $3);
      }), o('Expression LOGIC    Expression', function() {
        return new Op(this.$2.first_line, this.$2.first_column, $2, $1, $3);
      }), o('Expression RELATION Expression', function() {
        if ($2.charAt(0) === '!') {
          return new Op(this.$2.first_line, this.$2.first_column, $2.slice(1), $1, $3).invert();
        } else {
          return new Op(this.$2.first_line, this.$2.first_column, $2, $1, $3);
        }
      }), o('SimpleAssignable COMPOUND_ASSIGN\
       Expression', function() {
        return new Assign(this.$2.first_line, this.$2.first_column, $1, $3, $2);
      }), o('SimpleAssignable COMPOUND_ASSIGN\
       INDENT Expression OUTDENT', function() {
        return new Assign(this.$2.first_line, this.$2.first_column, $1, $4, $2);
      }), o('SimpleAssignable EXTENDS Expression', function() {
        return new Extends(this.$2.first_line, this.$2.first_column, $1, $3);
      })
    ]
  };
  operators = [['left', '.', '?.', '::'], ['left', 'CALL_START', 'CALL_END'], ['nonassoc', '++', '--'], ['left', '?'], ['right', 'UNARY'], ['left', 'MATH'], ['left', '+', '-'], ['left', 'SHIFT'], ['left', 'RELATION'], ['left', 'COMPARE'], ['left', 'LOGIC'], ['nonassoc', 'INDENT', 'OUTDENT'], ['right', '=', ':', 'COMPOUND_ASSIGN', 'RETURN', 'THROW', 'EXTENDS'], ['right', 'FORIN', 'FOROF', 'BY', 'WHEN'], ['right', 'IF', 'ELSE', 'FOR', 'DO', 'WHILE', 'UNTIL', 'LOOP', 'SUPER', 'CLASS'], ['right', 'POST_IF']];
  tokens = [];
  for (name in grammar) {
    alternatives = grammar[name];
    grammar[name] = (function() {
      var _i, _j, _len, _len2, _ref, _results;
      _results = [];
      for (_i = 0, _len = alternatives.length; _i < _len; _i++) {
        alt = alternatives[_i];
        _ref = alt[0].split(' ');
        for (_j = 0, _len2 = _ref.length; _j < _len2; _j++) {
          token = _ref[_j];
          if (!grammar[token]) {
            tokens.push(token);
          }
        }
        if (name === 'Root') {
          alt[1] = "return " + alt[1];
        }
        _results.push(alt);
      }
      return _results;
    })();
  }
  exports.parser = new Parser({
    tokens: tokens.join(' '),
    bnf: grammar,
    operators: operators.reverse(),
    startSymbol: 'Root'
  });
}).call(this);
