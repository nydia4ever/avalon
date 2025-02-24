
var parseExpr = require('./parseExpr')
var parseBindings = require('./parseBindings')
var parseDelimiter = require('./parseDelimiter')
var rexpr = avalon.config.rexpr
var quote = avalon.quote
var makeHashCode = avalon.makeHashCode
var r = require('../../seed/regexp')
var rident = r.ident
var rsp = r.sp
function wrapDelimiter(expr) {
    return rident.test(expr) ? expr : parseExpr(expr,'text')
}

function wrap(a, num) {
    return '(function(){\n\n' + a + '\n\nreturn vnodes' + num + '\n})();\n'
}

function parseView(arr, num) {
    num = num || String(new Date - 0).slice(0, 5)

    var forstack = []
    var hasIf = false
    var children = 'vnodes' + num
    var vnode = 'vnode' + num
    var str = 'var ' + children + ' = []\n'
    for (var i = 0; i < arr.length; i++) {
        var el = arr[i]
        if (el.nodeType === 3) {
            str += 'var ' + vnode + ' = {type:"#text",nodeType:3,skipContent:true}\n'
            var hasDelimiter = rexpr.test(el.nodeValue)

            if (hasDelimiter) {
                var array = parseDelimiter(el.nodeValue)
                if (array.length === 1) {
                    var a = parseExpr(array[0].expr)
                    str += vnode + '.nodeValue = ' + wrapDelimiter(array[0].expr) + '\n'
                } else {
                    a = array.map(function (el) {
                        return el.type ? wrapDelimiter(el.expr) : quote(el.expr)
                    }).join(' + ')
                    str += vnode + '.nodeValue = String(' + a + ')\n'
                }
                str += vnode + '.fixIESkip = true\n'
                /* jshint ignore:start */
                str += vnode + '.skipContent = false\n'
            } else {
                if (rsp.test(el.nodeValue)) {
                    str += vnode + '.nodeValue = "\\n"\n'
                } else {
                    str += vnode + '.nodeValue = ' + quote(el.nodeValue) + '\n'
                }
            }
            str += children + '.push(' + vnode + ')\n'
            continue
        } else if (el.nodeType === 8) {
            var nodeValue = el.nodeValue
            if (nodeValue.indexOf('ms-for:') === 0) {// 处理ms-for指令
                var signature = el.signature
                forstack.push(signature)
                str += '\nvar ' + signature + ' = {' +
                        '\n\tnodeType:8,' +
                        '\n\ttype:"#comment",' +
                        '\n\tvmodel:__vmodel__,' +
                        '\n\tdirective:"for",' +
                        '\n\tskipContent:false,' +
                        '\n\tcid:' + quote(el.cid) + ',' +
                        '\n\tstart:' + children + '.length,' +
                        '\n\tsignature:' + quote(signature) + ',' +
                        '\n\tnodeValue:' + quote(nodeValue) +
                        '\n}\n'
                str += children + '.push(' + signature + ')\n'

                str += avalon.directives['for'].parse(el, num)

            } else if (nodeValue.indexOf('ms-for-end:') === 0) {
                var signature = forstack[forstack.length - 1]
                str += children + '.push({' +
                        '\n\tnodeType: 8,' +
                        '\n\ttype:"#comment",' +
                        '\n\tskipContent: true,' +
                        '\n\tnodeValue:' + quote(signature) + ',' +
                        '\n\tkey:traceKey\n})\n'
                str += '\n})\n' //结束循环
                if (forstack.length) {
                    var signature = forstack[forstack.length - 1]
                    str += signature + '.end =' + children + '.push({' +
                            '\n\tnodeType: 8,' +
                            '\n\ttype:"#comment",' +
                            '\n\tskipContent: true,' +
                            '\n\tsignature:' + quote(signature) + ',' +
                            '\n\tnodeValue:' + quote(signature + ':end') +
                            '\n})\n'
                    forstack.pop()
                }
            } else if (nodeValue.indexOf('ms-js:') === 0) {//插入普通JS代码
                str += parseExpr(nodeValue.replace('ms-js:', ''), 'js') + '\n'
            } else {
                str += children + '.push(' + quote(el) + ')\n\n\n'
            }
            continue
        } else { //处理元素节点

            str += 'var ' + vnode + ' = {' +
                    '\n\tnodeType:1,' +
                    '\n\ttype: ' + quote(el.type) + ',' +
                    '\n\tprops:{},' +
                    '\n\tchildren: [],' +
                    '\n\tisVoidTag: ' + !!el.isVoidTag + ',' +
                    '\n\ttemplate: ""}\n'

            var hasWidget = el.props['ms-widget']
            if (!hasWidget && el.type.indexOf('-') > 0 && !el.props.resolved) {
                el.props['ms-widget'] = '@' + el.type.replace(/-/g, "_")
            }

            var hasBindings = parseBindings(el.props, num, el)
            if (hasBindings) {
                str += hasBindings
            }
            if (!el.isVoidTag) {
                if (el.children.length) {
                    var hasWidget = el.props['ms-widget']
                    var hasIf = el.props['ms-if']
                    if (hasIf) {
                        str += 'if(' +vnode+'&&'+ vnode + '.nodeType === 1 ){\n'
                    }
                    if (hasWidget) {
                        str += 'if(!' + vnode + '.props.wid ){\n'
                    }
                    str += vnode + '.children = ' + wrap(parseView(el.children, num), num) + '\n'
                    if (hasIf) {
                        str += '}\n'
                    }
                    if (hasWidget) {
                        str += '}\n'
                    }
                } else {
                    str += vnode + '.template = ' + quote(el.template) + '\n'
                }
            }
            str += children + '.push(' + vnode + ')\n'
        }

    }
    return str
}
avalon.htmlFactory = function(str, num){
  var vtree = avalon.lexer(str+"")
  avalon.__html = []
  var render =  parseView(vtree, num) + '\nreturn (avalon.__html = vnodes' + num + ')'
  return {
    render: render
  }
}

module.exports = parseView