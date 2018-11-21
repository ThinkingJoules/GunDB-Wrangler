"use strict";
import globalVar from 'global';
import Ajv from 'ajv';
var Gun = globalVar.Gun// || require('gun');
var ajv = new Ajv();
var nodeTypes

if (!Gun)
	throw new Error("gundb-wrangle: Gun was not found globally!");

wrangle(Gun.chain);

function wrangle(gun) {
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
}

//utility helpers
function settle(newData) {
    let gun = this;
    let gunRoot = this.back(-1);
    let nodeID = gun['_']['soul'].split('/')[1]//or ID string
    let type = gun['_']['soul'].split('/')[0]
    let nodeSoul = gun['_']['soul']//gun id 'get' string
    if(!nodeTypes[type]){return console.log('INVALID NODETYPE')}
    //run newData through ajv
    let oldData
    gun.on(function(e){oldData = e})
    console.log(oldData)
        if (oldData){
            //if the node already exists
            let result = nodeTypes[type].settle(newData,oldData)
            for(const key in result.putObj){
                if(!nodeTypes[type].whereTag.includes(key)){//skip tag fields, tags() handles this
                    gun.get(key).put(result.putObj[key])
                }
            }
            handleTags(gun, result, type)
        }else{
            //for a new node
            gun.get('!ID').put(nodeID)
            gunRoot.get('!TYPE/'+type).get(nodeSoul).put({'#':nodeSoul}) //setlist collection of same type nodes
            let result = nodeTypes[type].settle(newData,false)
            for(const key in result.putObj){
                if(!nodeTypes[type].whereTag.includes(key)){//skip tag fields, tag() handles this
                    gun.get(key).put(result.putObj[key])
                }
            }
            handleTags(gun, result, type)
            
        }
        return gunRoot.get(nodeSoul)
    //})
}
function doubleLink(target){//intended to be used in place of .set. Target should be a gun.get("nodeType/00someID00")
    let gun = this;
    let fromProp = gun['_']['get'] || false//gun id last 'get', should be a prop of a known nodeType
    let nodeSoul = gun['_']['soul'] || false //should be undefined > false if they 'get' to a setlist node
    if(nodeSoul){
        return console.log('Must select a property of a node with known nodeType, not the node itself. ie; .get("nodeType/00someID00").get("property").link(node)')}

    let fromNode
    let targetNode
    gun.back().on(function(e){fromNode=e})
    if (fromNode){
        if(!fromNode[fromProp] || typeof fromNode[fromProp] !== 'object' || fromNode[fromProp] === null){gun.put({})}
        let parentType = fromNode['!TYPE']
        let parentNodeSoul = Gun.node.soul(fromNode)
        if(!nodeTypes[parentType]){return console.log('INVALID NODETYPE')}
            target.on(function(e){targetNode=e})
            if (targetNode){
                console.log(targetNode)
                let targetType = targetNode['!TYPE']
                let targetNodeSoul = Gun.node.soul(targetNode)
                if(!nodeTypes[targetType]){return console.log('INVALID TARGET NODETYPE')}
                //if the node already exists and is of known type
                    //Make sure the link is coming from a 'prev' key
                        //if not, invert parent and target, check again
                        //if not, error out
                let parentNextKey = Object.keys(nodeTypes[parentType]['next'])[0] //should only ever be a sinlge next key
                if(fromProp == parentNextKey){//if we are coming from the prev node (wrong way, should link down the tree)
                    let fromChoices = Object.values(nodeTypes[targetType]['prev'])
                    if(fromChoices.includes(fromProp)){
                        if(!target[inverseProp] || typeof target[inverseProp] !== 'object' || target[inverseProp] === null){target.get(inverseProp).put({})}
                        let inverseProp = getKeyByValue(nodeTypes[targetType]['prev'], fromProp)//find correct prop to link prev node to
                        target.get(inverseProp).get(parentNodeSoul).put({'#':parentNodeSoul}) //set
                        gun.get(targetNodeSoul).put({'#': targetNodeSoul})//double set
                    }else{
                        return console.log('cannot link a next property, needs to be a prev property')
                    }

                }else{
                let targetNextProp = Object.keys(nodeTypes[targetType]['next'])[0] //should only ever be a sinlge next key
                if(!target[targetNextProp] || typeof target[targetNextProp] !== 'object' || target[targetNextProp] === null){target.get(targetNextProp).put({})}
                //correct orientation was entered
                gun.get(targetNodeSoul).put({'#':targetNodeSoul}) //set
                console.log(targetNodeSoul)
                target.get(targetNextProp).get(parentNodeSoul).put({'#':parentNodeSoul})//double set
                }
            }else{
                //no data
                return console.log('NODE DOES NOT EXIST')
            }
        }else{
            //no data
            return console.log('NODE DOES NOT EXIST')
        }
    return gun
}
function doubleUnlink(target){//intended to be used in place of .set. Target should be a gun.get("nodeType/00someID00")
    let gun = this;
    let fromProp = gun['_']['get'] || false//gun id last 'get', should be a prop of a known nodeType
    let nodeSoul = gun['_']['soul'] || false //should be undefined > false if they 'get' to a setlist node
    if(nodeSoul){
        return console.log('Must select a property of a node with known nodeType, not the node itself. ie; .get("nodeType/00someID00").get("property").link(node)')}
    gun.back().once(function(fromNode){
        if (fromNode){
            let parentType = fromNode['!TYPE']
            let parentNodeSoul = Gun.node.soul(fromNode)
            if(!nodeTypes[parentType]){return console.log('INVALID NODETYPE')}
            target.once(function(targetNode){
                if (targetNode){
                    let targetType = targetNode['!TYPE']
                    let targetNodeSoul = Gun.node.soul(targetNode)
                    if(!nodeTypes[targetType]){return console.log('INVALID TARGET NODETYPE')}
                    //if the node already exists and is of known type
                        //Make sure the link is coming from a 'prev' key
                            //if not, invert parent and target, check again
                            //if not, error out
                    let parentNextKey = Object.keys(nodeTypes[parentType]['next'])[0] //should only ever be a sinlge next key
                    if(fromProp == parentNextKey){//if we are coming from the prev node (wrong way, should link down the tree)
                        let fromChoices = Object.values(nodeTypes[targetType]['prev'])
                        if(fromChoices.includes(fromProp)){
                            let inverseProp = getKeyByValue(nodeTypes[targetType]['prev'], fromProp)//find correct prop to link prev node to
                            target.get(inverseProp).get(parentNodeSoul).put(null) //set
                            gun.get(targetNodeSoul).put(null)//double set
                        }else{
                            return console.log('cannot link a next property, needs to be a prev property')
                        }

                    }else{
                        //correct orientation was entered
                        let targetNextProp = Object.keys(nodeTypes[targetType]['next'])[0] //should only ever be a sinlge next key
                        gun.get(targetNodeSoul).put(null) //set
                        target.get(targetNextProp).get(parentNodeSoul).put(null)//double set
                    }
                }else{
                    //no data
                    return console.log('NODE DOES NOT EXIST')
                }
            })
        }else{
            //no data
            return console.log('NODE DOES NOT EXIST')
        }
    })
    return gun
}
function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
}
function newNode(nodeType){
    let gun = this
    let id = Gun.text.random(24)
    gun.get(nodeType + '/' + id)
    if (nodeTypes[nodeType]){
        //gun.get('!ID').put(id) // save for settle, in case it doesn't get created
        return gun.get(nodeType + '/' + id)
    }else{
        console.log(nodeType, ' IS NOT A VALID TYPE')
    }
}
function archive(){
    let gun = this;
    let gunRoot = this.back(-1)
    let result = {}
    let type
    let nodeSoul = gun['_']['soul'] || false
    if(!nodeSoul){
        return console.log('Must select a node with known nodeType. ie; .get("nodeType/00someID00").archive()')}
    gun.on(function(archiveNode){
        type = archiveNode['!TYPE']
        let forceDelete = archiveNode['!DELETED'] || false
        let props = nodeTypes[type].whereTag
        for (let i = 0; i < props.length; i++){
            result[props[i]] = {add: [],remove: []}
            gun.get(props[i]).once(function(tags){
                for (const key in tags) {
                    if(forceDelete && tags[key] !== '_' && tags[key] !== '!ARCHIVED'){
                        result[props[i]].remove.push(key) //null all tags even if they are '0'
                    }else if(tags[key] == 1){
                        gun.get(props[i]).get('!ARCHIVED').get(key).put(1)
                        result[props[i]].remove.push(key)
                    }
                }
            })
        }
        gun.get('!DELETED').put(true)
        gunRoot.get('!TYPE/'+type).get(nodeSoul).put(null)
        gunRoot.get('!TYPE/'+type+'/ARCHIVED').get(nodeSoul).put({'#': nodeSoul})
        console.log(result)

    })
    console.log(result)
    handleTags(gun,result,type)
}
function unarchive(){
    let gun = this;
    let gunRoot = this.back(-1)
    let type
    let result = {}
    let nodeSoul = gun['_']['soul'] || false
    if(!nodeSoul){
        return console.log('Must select a node with known nodeType. ie; .get("nodeType/00someID00").archive()')}
    gun.on(function(archiveNode){
        type = archiveNode['!TYPE']
        let props = nodeTypes[type].whereTag
        for (let i = 0; i < props.length; i++){
            result[props[i]] = {add: [],remove: []}
            gun.get(props[i]).get('!ARCHIVED').once(function(tags){
                for (const key in tags) {
                    if(tags[key] == 1){
                        
                        result[props[i]].add.push(key)
                    }
                }
            })
            gun.get(props[i]).get('!ARCHIVED').put(null)
        }
        gun.get('!DELETED').put(false)
        gunRoot.get('!TYPE/'+type).get(nodeSoul).put({'#': nodeSoul})
        gunRoot.get('!TYPE/'+type+'/ARCHIVED').get(nodeSoul).put(null)

    })
    console.log(result)
    handleTags(gun,result,type)
}
function deleteNode(){
    let gun = this;
    let gunRoot = this.back(-1)
    let fromNodeSoul = gun['_']['soul'] || false
    let fromType
    if(!fromNodeSoul){
        return console.log('Must select a node with known nodeType. ie; .get("nodeType/654someID123").delete()')}
    gun.on(node => fromType = node['!TYPE'])
    let nextKey = Object.keys(nodeTypes[fromType]['next'])[0] //should only ever be a sinlge next key
    let prevKeys = Object.keys(nodeTypes[fromType]['prev'])
    //gather 'next'
    let nextNodes = {}
    gun.get(nextKey).on(function(ids){
        for (const key in ids) {
            if(ids[key] !== null){
                nextNodes[key] = {'#':key}
            }
        }
    })
    //gather 'prev'
    let prevNodes = {}
    for (let i = 0; i < prevKeys.length; i++) {
        const prop = prevKeys[i];
        gun.get(prop).on(function(ids){
            for (const key in ids) {
                if(ids[key] !== null){
                    prevNodes[key] = prop
                }
            }
        })
    }
    //unlink
    for (const key in prevNodes) {
        let prop = prevNodes[key]
        gun.get(prop).unlink(gunRoot.get(key))
    }
    for (const key in nextNodes) {
        gun.get(nextKey).unlink(gunRoot.get(key))
    }


    gun.once(function(archiveNode){//null out fields
        let type = archiveNode['!TYPE']
        for (const key in archiveNode) {
            if(key !== '_'){//otherwise we break things
                gun.get(key).put(null)
            }
        }
        gunRoot.get('!TYPE/'+type+'/ARCHIVED').get(fromNodeSoul).put(null)
        gunRoot.get('!TYPE/'+type+'/DELETED').get(fromNodeSoul).put({'#': fromNodeSoul})
    })
}
//utility helpers

// Tag logic
function handleTags(gun, result, type){
    let props = nodeTypes[type].whereTag
    for (let i = 0; i < props.length; i++){
        for (let j = 0; j < result[props[i]].add.length; j++){
            tags(gun, result[props[i]].add[j],props[i])
        }
        for (let j = 0; j < result[props[i]].remove.length; j++){
            untag(gun, result[props[i]].remove[j],props[i])
        }
    }
};
function tags(gun, tag, scope) {
    if(!tag || typeof tag !== 'string' ) { return };
    let gunRoot = gun.back(-1);
    let nodeSoul = gun['_']['soul']
    let type
    gun.on(node => type = node['!TYPE'])
    //first 3 will be used for data retrieval in the UI
    gunRoot.get('!TAGS/' + tag).get(nodeSoul).put({'#':nodeSoul});//get nodes of all types with any tag 'tag' (ignore which prop or 'scope')
    gunRoot.get('!TAGS/' + scope).get(tag).get(nodeSoul).put({'#':nodeSoul});//get nodes of all types with a scoped tag 'scope' with tag 'tag'
    gunRoot.get('!TAGS/' + type + '/' + scope).get(tag).get(nodeSoul).put({'#':nodeSoul});//get nodes of specific type with a scoped tag 'prop' with tag 'tag'
    //next 3 would be used to populate dropdowns or autofills in certain contexts in the UI, 1 means visible, 0 means archived
    gunRoot.get('!TAGS_LIST').get(tag).once(function(_tag){
        if(_tag === undefined){// add new tag to lists
            gunRoot.get('!TAGS_LIST').get(tag).put(1);
        }
    })
    gunRoot.get('!TAGS_LIST/' + scope).get(tag).once(function(_tag){
        if(_tag === undefined){// add new tag to lists
            gunRoot.get('!TAGS_LIST/' + scope).get(tag).put(1);
        }
    })
    gunRoot.get('!TAGS_LIST/SCOPES').get(scope).once(function(_tag){
        if(_tag === undefined){// add new tag to lists
            gunRoot.get('!TAGS_LIST/SCOPES').get(scope).put(1);
        }
    })
    gunRoot.get('!TAGS_LIST/' + type + '/' + scope).get(tag).once(function(_tag){
        if(_tag === undefined){// add new tag to lists
            gunRoot.get('!TAGS_LIST/' + type + '/' + scope).get(tag).put(1);
        }
    })
    //set tag state on node, 1 means current tag, 0 means tag was removed
    gun.get(scope).get(tag).put(1);
};
function untag(gun, tag, prop) {
    if(!tag || typeof tag !== 'string' ) { return };
    let gunRoot = gun.back(-1);
    let nodeSoul = gun['_']['soul']
    let type

    gun.on(node => type = node['!TYPE'])
    console.log(type)
    //first 3 will be used for data retrieval in the UI
    gunRoot.get('!TAGS/' + tag).get(nodeSoul).put(null);//get nodes of all types with any tag 'tag' (ignore which prop or 'scope')
    gunRoot.get('!TAGS/' + prop).get(tag).get(nodeSoul).put(null);//get nodes of all types with a scoped tag 'prop' with tag 'tag'
    gunRoot.get('!TAGS/' + type + '/' + prop).get(tag).get(nodeSoul).put(null);//get nodes of specific type with a scoped tag 'prop' with tag 'tag'
    //set tag state on node, 1 means current tag, 0 means tag was removed
    gun.get(prop).get(tag).put(0).on(e=> console.log(e));
};
function getTagged(tags, matchedKeys, inc, gun){//tags is an array of objects, with keys of tag, prop, and type
    /* sample tags
    [{
        tag: 'thing', //optional
        scope: 'property'  //optional
        type: 'nodeType' //optional
    }]
    */
    
    tags = tags || []
    
    console.log(tags)
    gun = gun || this.back(-1)
    matchedKeys = matchedKeys || {}
    if(arguments.length === 1 && inc === undefined){//first call
        if(!Array.isArray(tags)){
            let arrTags = []
            arrTags.push(tags)
            tags = arrTags
        }
        let initialKeys = getTagged(tags[0], matchedKeys, 0, gun)//list to check against
        if(tags.length > 1){
            for (let i = 1; i < tags.length; i++) {
                getTagged(tags[i], initialKeys, i, gun)
            }
        }
        console.log(initialKeys)
        let matchedNodes = []
        for (const key in initialKeys) {
            gun.get(key).on(e=> matchedNodes.push(e))
        }
        return matchedNodes
    }else{//2,3,..n calls
        //expects an object, not array on all calls after first
        const keys = Object.keys(tags)
        let newKeys = {}
        switch (keys.length) {//number of keys in tag query object
            case 3:
                gun.get('!TAGS/' + tags.type + '/' + tags.scope).get(tags.tag).on(function(ids){
                    for (const key in ids) {
                        if(ids[key] !== null){
                            newKeys[key] = {'#':key}
                        }
                    }
                })
                break;
            case 2:
                if(keys.includes('tag')&&keys.includes('scope')){
                    gun.get('!TAGS/' + tags.scope).get(tags.tag).on(function(ids){
                        for (const key in ids) {
                            if(ids[key] !== null){
                                newKeys[key] = {'#':key}
                            }
                         }
                         newKeys = ids})
                }
                if(keys.includes('tag')&&keys.includes('type')){
                    let ids = {};
                    gun.get('!TAGS/' + tags.tag)
                        .map(function(node, id){
                            if (node == null){undefined}
                            else if(node['!TYPE'] === tags.type){
                                newKeys[id]={'#':id}
                            }else{undefined}
                        })
                }
                if(keys.includes('type')&&keys.includes('scope')){
                    let ids = {};
                    gun.get('!TAGS/' + tags.scope).map()
                        .map(function(node, id){
                            if (node == null){undefined}
                            else if(node['!TYPE'] === tags.type){
                                newKeys[id]={'#':id}
                            }else{undefined}
                         })
                }
                break;
            case 1:
                if (keys.includes('type')) {
                    gun.get('!TYPE/' + tags.type).on(function(ids){
                        for (const key in ids) {
                            if(ids[key] !== null){
                                newKeys[key] = {'#':key}
                            }
                        }
                    })
                }
                if (keys.includes('scope')) {
                    let ids = {};
                    gun.get('!TAGS/' + tags.scope).map()
                        .map(function(ids){
                            for (const key in ids) {
                                if(ids[key] !== null){
                                    newKeys[key] = {'#':key}
                                }
                            }
                         })
                }
                if (keys.includes('tag')) {
                    gun.get('!TAGS/' + tags.tag).on(function(ids){
                        for (const key in ids) {
                           if(ids[key] !== null){
                               newKeys[key] = {'#':key}
                           }
                        }    
                    })
                }
            
                break;
        
            default:
                break;
        }
        if(Object.keys(matchedKeys).length == 0){//only runs on 2nd call of function
            let objCopy = Object.assign({},newKeys)
            return objCopy
        }else{// checks for keys in this call vs the initial call keys
            for (const key in matchedKeys) {
                if(!newKeys.hasOwnProperty(key)){
                    delete matchedKeys[key]//removes all keys that don't match
                }
            }
        }
    }
};
function getTags(tags){//no args, get 'TAGS_LIST', otherwise object with keys of 'scope' and/or 'type'
    tags = tags || false
    let gun = this.back(-1)
    if(!tags){
        gun.get('!TAGS_LIST').once(e=>console.log("All tags", e))
        gun.get('!TAGS_LIST/SCOPES').once(e=>console.log("All scopes", e))

        return gun
    }
    if(tags.hasOwnProperty('type' && !tags.hasOwnProperty('scope'))){
        console.log('Please provide a scope or type + scope')
    }
    if(tags.hasOwnProperty('scope') && !tags.hasOwnProperty('type')){
        gun.get('!TAGS_LIST/' + tags.scope).on(e=>console.log('scope tags ', e))
        return gun.get('!TAGS_LIST/' + tags.scope)
    }
    if(tags.hasOwnProperty('scope')&&tags.hasOwnProperty('type')){
        gun.get('!TAGS_LIST/' + tags.type + '/' + tags.scope).on(e=>console.log('type + scope tags ', e))
        return gun.get('!TAGS_LIST/' + tags.type + '/' + tags.scope)
    }
}
function archiveTag(tag){//object with keys of 'tag', 'scope' and/or 'type'
    tag = tag || false
    let gun = this.back(-1)
    if(!tag || !tag.tag){
        gun.get('!TAGS_LIST').once(e=>console.log("All tags", e))
        gun.get('!TAGS_LIST/SCOPES').once(e=>console.log("All scopes", e))

        return gun
    }
    if(tag.hasOwnProperty('type' && !tag.hasOwnProperty('scope'))){
        console.log('Please provide a scope or type + scope')
    }
    if(tag.hasOwnProperty('scope') && tag.hasOwnProperty('tag') && !tag.hasOwnProperty('type')){
        gun.get('!TAGS_LIST/' + tag.scope).get(tag.tag).put(0)
        return gun.get('!TAGS_LIST/' + tag.scope)
    }
    if(tag.hasOwnProperty('scope')&&tag.hasOwnProperty('type')){
        gun.get('!TAGS_LIST/' + tag.type + '/' + tag.scope).get(tag.tag).put(0)
        return gun.get('!TAGS_LIST/' + tag.type + '/' + tag.scope)
    }
}
//Tag logic

//Tree Logic
function addNodeTypes(nodeTypesObj) {
    nodeTypes = nodeTypesObj
    //VALIDATE EXT SCHEMA FILE FOR REQUIRED FIELDS AND SUCH

    //add schema to ajv?

}
function assembleTree(gun, node, fromID, max, inc, arr){
    let res
    let idRef
    let newNode
    if(inc === undefined){//initial call
        newNode = Gun.obj.copy(node)
        inc = 0
        max = max || Infinity
        arr = [[],[]];
        let arrObj = {id: fromID,
                    data: newNode,
                    from: false,
                    prop: false
                    }   
        arr[0][0] = arrObj
        res = [node, arr]
        fromID = fromID
        
    }
    if(inc == max){return}
    inc+=1
    let refsToTraverse = Object.keys(nodeTypes[node['!TYPE']]['prev'])
    if (refsToTraverse){
        for (let i = 0; i < refsToTraverse.length; i++){
            if (node[refsToTraverse[i]]){
                if(!Array.isArray(arr[inc])){arr[inc] = []}
                let lookup = node[refsToTraverse[i]]["#"]
                let id = {id: lookup} //arr
                idRef = Object.assign({}, id) //arr
                let subthings = []
                console.log(lookup)
                gun.get(lookup).map(function(node,id){
                    subthings.push(node)
                    let newObj = Object.assign({}, node)
                    let nodeInfo = {data: newObj,
                                    from: fromID,
                                    prop: refsToTraverse[i]}
                    let arrObj = Object.assign({}, idRef, nodeInfo)
                    arr[inc].push(arrObj) 
                })
            node[refsToTraverse[i]] = Gun.obj.copy(subthings)
            }
        }
        //console.log(node)
        //console.log(arr)
        for (let i = 0; i < refsToTraverse.length; i++){
            if (node[refsToTraverse[i]]){
                for (let j = 0; j < node[refsToTraverse[i]].length; j++){
                let nextLevel = node[refsToTraverse[i]][j]
                assembleTree(gun, nextLevel, idRef.id, max, inc, arr);//fires for each prop with refs, and once for each ref on said prop
                }
            }
        }
    }
    //accumulate math?
    return res; // Should return the full tree
}
export function reduceRight(treeArr, method , acc){
    acc = acc || false //accumulate all mapper returns to single value, if false, will tree reduce
    let reduced = 0
    let calcArr = JSON.parse(JSON.stringify(treeArr))//?
    treeArr.push(calcArr)
    for (let i = calcArr.length-1; i > -1; i--){
        for (let j = 0; j < calcArr[i].length; j++){
            let node = (calcArr[i][j].data) ? calcArr[i][j].data : calcArr[i][j]//?
            let fromID = calcArr[i][j].from
            let fromProp = calcArr[i][j].prop
            if(node){
                let mapper = nodeTypes[node['!TYPE']]["methods"][method]
                let res = mapper(node)
                reduced += res
                console.log(res)
                calcArr[i][j].data = res//?
                let parent = _.find(calcArr[i-1], ['id', fromID])
                if(!parent){
                    console.log(reduced)
                    treeArr = res
                }else{
                    if(typeof parent.data[fromProp] === 'object'){//if it is a ref, replace with first valie
                    parent.data[fromProp] = res
                    }else{
                        parent.data[fromProp] += res //if not a ref, then take old value and add it to new value
                        console.log(calcArr)
                    }
                }
            }
        }
    }
    let ret = (acc) ? reduced : treeArr
    return ret
}
function generateTreeObj(startNodeID, max){
    let gun = this.back(-1)
    if (startNodeID['_']['$']){startNodeID = startNodeID['_']['soul']}
	let parentNode
	gun.get(startNodeID).on(e => parentNode = Gun.obj.copy(e))
    let tree = assembleTree(gun, parentNode, startNodeID, max)//?
    return tree[0]
}
function generateTreeArr(startNodeID, max){
    let gun = this.back(-1)
    if (startNodeID['_']['$']){startNodeID = startNodeID['_']['soul']}
	let parentNode
	gun.get(startNodeID).on(e => parentNode = Gun.obj.copy(e))
    let tree = assembleTree(gun, parentNode, startNodeID, max)//?
    return tree[1]
}
function treeReduceRight(startNodeID, method, acc, max){
    let gun = this.back(-1)
    if (startNodeID['_']['$']){startNodeID = startNodeID['_']['soul']}
	let parentNode
	gun.get(startNodeID).on(e => parentNode = Gun.obj.copy(e))
    let tree = assembleTree(gun, parentNode, startNodeID, max)//?
    let methodCalc = reduceRight(tree[1], method, acc)
    return methodCalc
}

//Tree Logic
