// phantomjs --config=../phantom.config test.js '' 1453773007662

var page = require('webpage').create()
var fs = require('fs')
var sys = require('system')

var ASYNC_COMMAND={}
var RunCount = 1
var Data, ImageName, URL, p, prev
var PageClip, EventCache, ViewportCache
var WHICH_MOUSE_BUTTON = {"0":"", "1":"left", "2":"middle", "3":"right"}

page.zoomFactor = 1;
//page.clipRect = { top: 10, left: 0, width: 640, height: 490 };
page.viewportSize = { width: 1000, height: 610 }
page.settings.userAgent = 'Mozilla/5.0 (Windows NT 5.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.57 Safari/537.36'
page.settings.resourceTimeout = 50000; // 5 seconds
page.settings.localToRemoteUrlAccessEnabled = true
page.settings.webSecurityEnabled = false
page.customHeaders = {
	"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
	"Pragma": "no-cache",
	"Connection": "keep-alive",
}

var commands = {}
function sendCommand(type, data, meta){
	var id = +new Date()+Math.random()+'_'
	var cmd = { id:id, type:type, data:data }
	if(meta) cmd.meta = meta
	commands.id = cmd
	sys.stdout.writeLine( '>'+JSON.stringify(cmd) )
}
function logError(){
	var args = [].slice.call(arguments)
	sys.stderr.write(args.join(' '))
}
phantom.onError = function  () {}
function init(){
	// fill all vars from args & json file
	if( sys.args.length<3 ){
		logError('bad param')
		phantom.exit(1)
		return
	}
	URL = sys.args[1] || 'http://1111hui.com/github/m_drag/index.html'
	ImageName = sys.args[2]
	if (!fs.exists( ImageName+'.json' )){
		logError('json not exists')
		return phantom.exit(1)
	}
	var content = fs.read( ImageName+'.json' )
	try{
		Data = JSON.parse( content )
	}catch(e){
		logError('bad json')
		return phantom.exit(1)
	}

	EventCache = Data.event
	ViewportCache = [EventCache[0].msg]
	PageClip = Data.clip

	page.open(URL)
}
init()

page.onLoadFinished=function(status){
	if(status!=='success'){
		logError('page open failed')
		return phantom.exit(1)
	}
	p=0
	prev = EventCache[0]
	testStep()
}
function testStep(diff){
	diff = diff || 0
	if(p>=EventCache.length){
		// console.log('finished')
		return phantom.exit(0)
	}
	var e=EventCache[p]
	var inter = e.time-prev.time-diff
	setTimeout( function() {
	  var t = Date.now()
	  if(e.msg) processMsg(e.msg, p===EventCache.length-1)
	  prev = e
	  p++
	  testStep(Date.now()-t)
	}, inter )
}

function processMsg(msg, isLast){

	if(typeof msg!='object'||!msg){
		logError('bad msg', ImageName, msg, p, JSON.stringify(EventCache[p]))
		phantom.exit(1)
	}

	switch(msg.type){

	  case 'page_clip':
	  	PageClip = msg.data
	  	
	  	break
	  case 'snapshot':
	  	var prevPos = page.scrollPosition
	  	page.scrollPosition = {   top: 0 ,   left: 0 }
		if( Object.keys(PageClip).length ) page.clipRect = {
		  top: PageClip.top|| page.scrollPosition.top,
		  left: PageClip.left|| page.scrollPosition.left,
		  width: PageClip.width|| page.viewportSize.width,
		  height: PageClip.height|| page.viewportSize.height,
		}

	  	page.render(msg.data+'_test.png')
	  	sendCommand('compareImage', msg.data, isLast?'last':'')

	  	page.clipRect = {}

	  	page.scrollPosition = prevPos
	  		  	
	  	break
	  case 'window_resize':
	  case 'window_scroll':
	    page.scrollPosition = {
		  top: msg.data.scrollY,
		  left: msg.data.scrollX
		}
		page.viewportSize = { width: msg.data.width, height: msg.data.height }
		// console.log( msg.type, JSON.stringify( msg.data ) )

	    break

	  // command from client.html
	  case 'command':
	      var cmd = msg.data.trim().split('(').shift()
	      var cb=function(result){
	      	  if(!msg.__id) return
	      	  if(arguments.length) msg.result = result	
	          delete msg.data
	          msg.type = 'command_result'
	          ws._send( msg )
	      }
	  	  var isAsync = cmd in ASYNC_COMMAND;
	  	  if( isAsync ) ASYNC_COMMAND[cmd] = cb;

	      try{
	        msg.result = eval( msg.data )
	      }catch(e){
	        msg.result = e.stack
	      }

	      if( !isAsync ) {
	      	cb()
	      }

	  	break

	  case 'event_mouse':
	  	var e = msg.data
	  	// console.log(e.type, e.pageX, e.pageY, e.which)
	  	e.type = e.type.replace('dbl', 'double')
	  	if( /click|down|up/.test(e.type) ) page.sendEvent('mousemove', e.pageX, e.pageY, WHICH_MOUSE_BUTTON[e.which] );
	  	page.sendEvent(e.type, e.pageX, e.pageY, WHICH_MOUSE_BUTTON[e.which] )

	  	break
	  default:
	    
	    break
	}

}
