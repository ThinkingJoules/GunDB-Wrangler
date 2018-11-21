# GunDB-Wrangler
GunDB-Wrangler is a plugin for Gun(^0.9.x) using `Gun.chain`.

Used to help wrangle your data! Helps you manage nodes in the following ways: define node types, tagging, archiving, linking/unlinking, and opening a linked tree (and do math on it!). For those not familiar with a graph database, this module might make it easier to get started building your first app.

[![npm](https://img.shields.io/npm/v/:package.svg)](https://github.com/ThinkingJoules/GunDB-Wrangler)[![npm bundle size (minified)](https://img.shields.io/bundlephobia/min/react.svg)](https://github.com/ThinkingJoules/GunDB-Wrangler)

## Features
* Node Types (To emulate collections or tables)
* Automatic node type keying and indexing
* Archive Node; Remove all tags, but keep in place on graph with a `{'!DELETED': true}` flag for filtering out of UI
* Unarchive Node; restore tags, remove deleted flag
* Delete Node; Null all fileds, unlink from everywhere in graph it was linked (according to Node Type)
* User Defined Transformations (UDT); To perform checks and conditional transforms on data going in to database
* Node Linking; Bi-directional set to build a traversable graph
* Tree Retrieval; Follow 'prev' links (only) from current node until 'x' iterations or 'root' node is found
* Tree ReduceRight; work from the bottom of the tree (where root data is) and apply a function based on Node Type found. Mapping up the tree to reduce the values.
* Tagging (with 'proptag/scope' and untagging); Can be combined with the user defined functions for conditional tagging through UDT
* Tag visibility; List of tags (and scopes) that can be pulled in to generate drop downs or autofills for UI.
* Tag queries; Intersects and returns all nodes that match the full query (&&)

#### Potential Features
* Formal schema validation (Kind of duplicate since UDT could re-implement validation)
* Unique Fields/Auto Incrementing; Technically has no gurantees since Gun is only eventually consistent, so could have conflicts

## When to Use
The initial goal was to do a different gun.open() that selectively follows links (as defined by the Node Type). If using gun.open() you have to be careful not to create many links, even if it would be helpful. But Gun is a graph database, the more linked your data the more rich and accurate your database is. That is why I built this. To link without worry, and still get an 'open' function that doesn't open the whole graph.
This assumes that your graph structure is some form of DAG, or you can define a terminating path.
Initial aim was to be able to model widgets made up of other widgets, and at some point a widget is purchased (root, contains no 'bill of materials'). As long as a stop condition is evident this module *should* work well. If your data looks much different than this, then be careful as I have not tested for it.



# Example Usage / Getting Started
Example of Widgets made of Widgets (+Labor Costs). Example assumes you have a working react app with gun installed.

#### Install
`npm i gundb-wrangler --save`
## Define Node Type
This module is centered around the type of each node in the graph. For this example it will have 3 type:
* Widget (the thing)
* Ops (short for 'Operations' - labor steps)
* BOM (Bill Of Materials, How many and of what widgets)

*Note: I'm diving right in, read [Key Concepts](#key-concepts) to better understand the example*
### Format - nodeTypes.js 
Make a new file, lets call it `nodeTypes.js` Lets framework it out and fill in data as we go:
```
const Widget = {}
const Op = {}
const BOM = {}

const nodes = {Widget, Op, BOM}
export default nodes
```
Here is the minimum object requirements for each node:
```
const NodeType = {
next: {},
prev: {},
whereTag: [],
methods: {}, 
settle: f(x) ///UDT function goes here
```
#### Think about your data!!
Before we start lets make a sample object for each node type so we can reference as we define our Node Types:
```
// widget
{
  name: 'awesome widget1',
  vendor_unit_cost: 0 //if we assembled it from other widgets
  ops: [op1, op2, op3],
  bom: [bom1, bom2],
  color_tag: [colorTag],
  tags: [tag1, tag2],
  contained_in: [bom4],
  sku: 12345
}
// op
{
  instructions: 'some info',
  processTime: 2,
  rate: 120
  used_in: {}, //reference to a Widget, our 'next'
}
// bom
{
  next: [widget1],
  prev: [widget2],
  qty: 2
}

```
Gun cannot do array's but I have displayed them in an array as that is easiest to explain this. Basically anytime you see/think of something array like, this module can help you deal with that in Gun. Quick explanation of these objects:  
In Widget:
* 'ops' and 'bom' will be 'prev' as they link to nodes that descibe this widget
* 'color_tag' and 'tags' are scoped tag fields (as noted in the *Key Concepts* section, 'tags' is colloquial for global tags)
* 'contained_in' is the next field

In op:
* 'used_in' is the next field, all others are root data

In bom:
* 'next' links to 'next', to where this information belongs
* 'prev' links to another widget, in concert with the 'qty' field we can resolve the cost of the 'next' widget.

#### Defining the Node Types
Here is our nodeTypes.js file with basic info entered:
```
const Widget = {
  next: {contained_in: 'prev'}, //if you follow 'contained_in' link, what key will you find reference to this node ('prev')
  prev: {ops: 'used_in', bom: 'next'},
  whereTag: ['color_tag', 'tags'],
  methods: {}, 
  settle: f(x) ///UDT function goes here
}
const Op = {
  next: {used_in: 'ops'},
  prev: {},
  whereTag: [],
  methods: {}, 
  settle: f(x) ///UDT function goes here
}

const BOM = {
  next: {'next': 'bom'},
  prev: {'prev': 'bom'},
  whereTag: [],
  methods: {}, 
  settle: f(x) ///UDT function goes here
}
``` 
To explain the comment under Widget.next: the key is simple, on the Widget node, what key is the 'next' reference. But why do we put 'prev' as the value. Think about traversing the graph. All structure keys are bi-directional (per this module). So we are saying "if you follow the reference that is in 'contained_in' you will arrive at another node. On that node, what key will contain the link back to where I started." So we start on a Widget, follow the 'next' link to a BOM node type. If we came from a next we are looking for a 'prev'. Convienently I named it 'prev'. In that list of (potentially) many links, there is one that points back to the specific node we came from.

#### Settle
This module wraps gun.put() in it's own api, gun.settle(). When you run .settle() you should get the node it self and not a property on the node. See [API Docs for usage](#api-docs). Basically you pass in data you want to input as a partial object to .settle(). The module will then perform your UDT that is saved under the 'settle' property of that particular Node Type. The settle function is required in your Node Type. **Below is the minimum settle function definition**:
```
function NodeTypeExampleSettle(newData, oldData){
    //also assume oldData will be falsy if this is a new put
    let result = {
        tag_field1: {add: [],remove: []},
        tag_field2: {add: [], remove: []},
        putObj: {}
    };
    return result
```
For each property that is in the whereTag array on the Node Type must have a corresponding key in the result object with an object as shown. Tags are explicit. If you return all add and remove arrays as empty it will not do anything. To remove you must specify tag(s) in the remove array.

**Below is the suggested settle function format**
```
function SuggestedSettle(newData, oldData){
    let result = {
        tag_field1: {add: [],remove: []},
        tag_field2: {add: [], remove: []},
        putObj: {}
    };
    let defObj = {}
    if(!oldData){
        //new put
        defObj['!TYPE'] = 'NodeType' //This should match your Node Type object name exactly
        //can define defaults for all fields if you so choose
  

        result.putObj = Object.assign({}, defObj, newData)
    }else{ 
      // expecting partial objects (only edits) to be put on updates, not full nodes
      result.putObj = newData
    }

    return result
}
```
Yes, like gun, this module must add stuff to your data in order to work. Everything added will be prefixed with '!' if you want to strip it out of your data for display purposes.
The '!TYPE' field is **THE MOST IMPORTANT**, without it nothing in this module works. Below are the settle functions for each node type:
```
function WidgetSettle(newData, oldData){
    let result = {
        color_tag: {add: [],remove: []},
        tags: {add: [], remove: []},
        putObj: {}
    };
    let defObj = {}
    if(!oldData){
        //new put
        defObj['!TYPE'] = 'Widget'
        defObj.name = 'noName'
        defObj.vendor_unit_cost: 0
        defObj.ops = false
        defObj.bom = false
        defObj.color_tag = false
        defObj.tags = false
        defObj.contained_in = false
        defObj.sku = null  

        result.putObj = Object.assign({}, defObj, newData)
    }else{
      result.putObj = newData
    }

    return result
}
function OpsSettle(newData, oldData){
    let result = {
        putObj: {}
    };
    let defObj = {}
    if(!oldData){
        //new put
        defObj['!TYPE'] = 'Op'
        defObj.instructions = 'I need directions!'
        defObj.processTime = 0
        defObj.rate = 120
        defObj.used_in = false

        result.putObj = Object.assign({}, defObj, newData)
    }else{
      result.putObj = newData
    }
    
    return result
}
function BOMSettle(newData, oldData){
    let result = {
        putObj: {}
    };
    let defObj = {}
    if(!oldData){
        //new put
        defObj['!TYPE'] = 'BOM'
        defObj.next = false
        defObj.prev = false
        defObj.qty = 0
        
        result.putObj = Object.assign({}, defObj, newData)
    }else{
      result.putObj = newData
    }
    
    return result
}
```
I like to create all properties on a new object, you don't have to, but it is easier to look at data if it all looks the same. I always put false for structure or tag links if I want to create them before I populate links or tags.

#### Methods
These are optional, and have to do with how we calculate things in the tree. We will be creating a 'cost' method that will give us the cost of a part by going down the tree until it gets to root data. Each node type needs to have a method with the same exact name. Below is the code for each node type:
```
function WidgetCost(node){
  let total
  total += node.vendor_unit_cost
  total += node.ops
  total += node.bom
  return total
}
function OpCost(node){
  let total
  let minute_rate
  minute_rate = node.rate / 60
  total = minute_rate * node.processTime
  return total
}
function BOMCost(node){
  let total
  total = node.prev * node.qty
  return total
}

```
Look at how simple and easy that math is! Since this is a reducing function, we assume all 'prev' fields will have their reference list replaced by the total 'cost' of all reference below it in the tree.

So all together your nodeTypes.js file should look like this:
```
const Widget = {
  next: {contained_in: 'prev'}, //if you follow 'contained_in' link, what key will you find reference to this node ('prev')
  prev: {ops: 'used_in', bom: 'next'},
  whereTag: ['color_tag', 'tags'],
  methods: {cost: WidgetCost}, 
  settle: WidgetSettle
}
const Op = {
  next: {used_in: 'ops'},
  prev: {},
  whereTag: [],
  methods: {cost: OpCost}, 
  settle: OpSettle
}

const BOM = {
  next: {'next': 'bom'},
  prev: {'prev': 'bom'},
  whereTag: [],
  methods: {cost: BOMCost}, 
  settle: BOMSettle
}
function WidgetSettle(newData, oldData){
    let result = {
        color_tag: {add: [],remove: []},
        tags: {add: [], remove: []},
        putObj: {}
    };
    let defObj = {}
    if(!oldData){
        //new put
        defObj['!TYPE'] = 'Widget'
        defObj.name = 'noName'
        defObj.vendor_unit_cost = 0
        defObj.ops = false
        defObj.bom = false
        defObj.color_tag = false
        defObj.tags = false
        defObj.contained_in = false
        defObj.sku = null  

        result.putObj = Object.assign({}, defObj, newData)
    }else{
      result.putObj = newData
    }

    return result
}
function OpSettle(newData, oldData){
    let result = {
        putObj: {}
    };
    let defObj = {}
    if(!oldData){
        //new put
        defObj['!TYPE'] = 'Op'
        defObj.instructions = 'I need directions!'
        defObj.processTime = 0
        defObj.rate = 120
        defObj.used_in = false

        result.putObj = Object.assign({}, defObj, newData)
    }else{
      result.putObj = newData
    }
    
    return result
}
function BOMSettle(newData, oldData){
    let result = {
        putObj: {}
    };
    let defObj = {}
    if(!oldData){
        //new put
        defObj['!TYPE'] = 'BOM'
        defObj.next = false
        defObj.prev = false
        defObj.qty = 0
        
        result.putObj = Object.assign({}, defObj, newData)
    }else{
      result.putObj = newData
    }
    
    return result
}
function WidgetCost(node){
  let total
  total += node.vendor_unit_cost
  total += node.ops
  total += node.bom
  return total
}
function OpCost(node){
  let total
  let minute_rate
  minute_rate = node.rate / 60
  total = minute_rate * node.processTime
  return total
}
function BOMCost(node){
  let total
  total = node.prev * node.qty
  return total
}

const nodes = {Widget, Op, BOM}
export default nodes
```
Now we are ready to try all of this out! Seems like a long road, but if you have any amount of node types or conditional tagging/indexing it is well worth the effort! Plus it puts all your logic in one spot to keep your UI components easy to understand and read.


### Example Usage
This is some basic API usage used on what we have defined above.

First we must get things imported.
```
//App.jsx
import Gun from 'gun/gun';
import * as wrangle from 'gundb-wrangler'
import nodeTypes from '../nodeTypes/nodeTypes'

class App extends Component {
  constructor() {
  super();
    this.gun = Gun(location.origin+'/gun');
    window.gun = this.gun;
  }

  render() {
    gun.addNodeTypes(nodeTypes)
    return (
```
Now fire up your app, and lets play with gun (and the new module) in the console of your browser.


```
//First lets make 3 new Widgets  
let widget1 = gun.newNode('Widget').settle({name: 'Widget1'})
let widget2 = gun.newNode('Widget').settle({name: 'Widget2'})
let widget3 = gun.newNode('Widget').settle({name: 'Widget3', vendor_unit_cost: 10})

//Next lets make some ops:

let w1op = gun.newNode('Op').settle({instructions: 'Widget1 assembly', processTime: 2, rate: 65})
let w2op = gun.newNode('Op').settle({instructions: 'Widget2 assembly', processTime: 6, rate: 85})
let w2op2 = gun.newNode('Op').settle({instructions: 'Widget2 assembly step 2', processTime: 12, rate: 105})

//And finally 2 BOM's:

let w1bom = gun.newNode('BOM').settle({qty: 2})
let w2bom = gun.newNode('BOM').settle({qty: 4})
// widget3 is a root node, so BOM will stay false

//So we now have 8 data nodes in our graph! However, they are not connected to each other. Lets do that:

widget1.get('ops').link(w1op)
widget2.get('ops').link(w2op)
widget2.get('ops').link(w2op2)
widget1.get('bom').link(w1bom)
widget2.get('bom').link(w2bom)
//now the fun part!
w1bom.get('prev').link(widget2)
w2bom.get('prev').link(widget3)
```
Boom! We now have a traversable graph. The .getTree only needs the node soul for where to start. Since are Widget1 is a gun object (not our data directly!) we can cheat and find it on that object:

____________________________________________
WIP

Let try out the tree

Lets try to find the cost of part1 .. part 3


















## **Key Concepts**
There are 3 types of properties in a node object (according to this module).
* Root Keys - Things with regular types (number, string, boolean, etc.)
* Structure Keys - Things with links to nodes that help define this node
* Tag Keys - Where tag or taglike information is stored for queries or indexing.
### Structure Keys
Structure keys are things that the module follows to build the tree or do the 'open'. For each node type we **must** define which keys will contain 'prev' and 'next' references.
#### prev and next ??
These are terms from linked lists. 'next' is going to move you away from root data nodes, 'prev' will move you toward root data nodes. A tree starts with roots (speaking literally), so it cannot have a previous link. Sorry if this is backwards from how you think of 'prev' and 'next' in a linked list, but this is the terms and definitions this module follows. The limitation here is that you can only ever have a single 'next' key.
* Think of 'prev' as things you must follow to resolve your current node (because it is made up of more info!!)
* Think of 'next' as a (singular) list of nodes where you can find a 'prev' link pointing back to this exact node.
### Tag Keys
Each key you define as a Tag Key will be the scope of that tag (if you choose, all tags can be queried globally as well, but could conflict with same tag in different scope). If you want a simple global tag scope, just use the same key name on all node types. If you don't want scoping, simply put a `tags` property on all node types. Tag Keys are basically indexes for queries later. This module allow multiple tags per property, if the developer would rather it be singular add a UDT that always removes the old one when a new tag comes in. *Tags Keys do not effect the tree structure at all.* It is basically there to provide indexed queries of your data to reduce look up times (avoid checking every node and comparing values)  
**/Key Conepts**


## Assumptions/Limitations
Under the hood this module treats everything as a gun.set(). We prevent opening the whole graph for a node of given type if we only follow the 'prev' links to generate a tree. So basically there are 3 types of properties in a node object (according to this module). First is the root data, or object keys that will only ever contain resolvable data directly on the node, numbers, strings, boolean, etc. We will call these *root* keys. Second is a key that is either a 'prev' or a 'next' link. The limitation here is that you can only ever have a single 'next' property. To explain: 'next' is going to move you away from root data nodes, 'prev' will move you toward root data nodes. A tree starts with roots, so it cannot have a previous. Sorry if this is backwards from how you think of 'prev' and 'next' in a linked list, but this is the terms and definitions this module follows. You can have as many different 'prev' properties as you want. There is more info in the example to illustrate this. This second key type we will call *structure* keys. Lastly, we have keys that are tags or tag like information (indexing). These will not contain references to setlists, but keys with the tag and value of either 1 (current tag) or 0 (removed tag). We will call these *tag* keys.



# API Docs
gun.addNodeTypes = addNodeTypes;
gun.newNode = newNode;
gun.settle = settle;
gun.getTree = generateTreeObj//returns object tree
gun.getTreeArr = generateTreeArr//returns array of levels in tree, work from right to left to go from bottom to top.
gun.treeReduceRight = treeReduceRight//would need options to map forward or backwards? Only bottom up?
gun.archiveTag = archiveTag//set tag to 0 in visibility lists
gun.getTagged = getTagged//(tags, prop, type), last two are optional, tags can be an array for intersect
gun.tags = getTags
gun.link = doubleLink //like a set to the 'child'/'prev' this also creates a back link on the child back to 'parent'/'next'
gun.unlink = doubleUnlink//opposite of link
gun.archive = archive
gun.unarchive = unarchive
gun.delete = deleteNode

wrangle.treeReduceRight


### FAQs


# Credit
gun-tag
Mark
Dleeta