# Line and Column Positions
# -------------------------

# No assumptions about where an instance of Block is located, it's just too
# ephemeral of a thing. Better not to test it because it isn't well defined and
# doesn't give us that good of information for mapping since the children are
# mapped anyways.

nodes = require '../lib/coffee-script/nodes'

TEST_CODE = """
square = (x) ->
  x * x
""".trim()

test "lines and columns", ->
  root = CoffeeScript.nodes(TEST_CODE)
  ok root instanceof nodes.Block
  eq 1, root.expressions.length, 'root.expressions.length'

  assignment = root.expressions[0]
  ok assignment instanceof nodes.Assign
  eq 0, assignment.line, 'assignment.line'
  eq 7, assignment.column, 'assignment.column'

  variable = assignment.variable
  ok variable instanceof nodes.Value
  eq 0, variable.line, 'variable.line'
  eq 0, variable.column, 'variable.column'
  ok variable.base instanceof nodes.Literal
  eq 0, variable.base.line, 'variable.line'
  eq 0, variable.base.column, 'variable.column'

  fn = assignment.value
  ok fn instanceof nodes.Code
  eq 0, fn.line, 'fn.line'
  eq 9, fn.column, 'fn.column'
  eq 1, fn.params.length, 'fn.params.length'

  param = fn.params[0]
  ok param instanceof nodes.Param
  eq 0, param.line, 'param.line'
  eq 10, param.column, 'param.column'
  ok param.name instanceof nodes.Literal
  eq 0, param.name.line, 'param.name.line'
  eq 10, param.name.column, 'param.name.column'

  fnbody = fn.body
  ok fnbody instanceof nodes.Block
  eq 1, fnbody.expressions.length, 'fnbody.expressions.length'

  op = fnbody.expressions[0]
  ok op instanceof nodes.Op
  eq 1, op.line, 'op.line'
  eq 4, op.column, 'op.column'

  ok op.first instanceof nodes.Value
  eq 1, op.first.line, 'op.first.line'
  eq 2, op.first.column, 'op.first.column'
  ok op.first.base instanceof nodes.Literal
  eq 1, op.first.base.line, 'op.first.base.line'
  eq 2, op.first.base.column, 'op.first.base.column'

  ok op.second instanceof nodes.Value
  eq 1, op.second.line, 'op.second.line'
  eq 6, op.second.column, 'op.second.column'
  ok op.second.base instanceof nodes.Literal
  eq 1, op.second.base.line, 'op.second.base.line'
  eq 6, op.second.base.column, 'op.second.base.column'
