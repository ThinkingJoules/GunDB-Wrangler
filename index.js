"use strict";
var globalVar = require("global");
//import Ajv from 'ajv';
if(typeof window !== "undefined"){
    var Gun = globalVar.Gun;
  } else {
    var Gun = global.Gun;
  }
//var ajv = new Ajv();
var nodeTypes

if (!Gun)
	throw new Error("gundb-wrangle: Gun was not found globally!");

wrangle(Gun.chain);

function wrangle(gun) {
    gun.addNodeTypes = addNodeTypes;
    gun.newNode = newNode;
    gun.settle = settle;
    gun.getTree = generateTreeObj//returns object tree
    gun.getTreeArray = generateTreeArr//returns array of levels in tree, work from right to left to go from bottom to top.
    gun.treeReduceRight = treeReduceRight//would need options to map forward or backwards? Only bottom up?
    gun.archiveTag = archiveTag//set tag to 0 in visibility lists
    gun.getTagged = getTagged//(tags, prop, type), last two are optional, tags can be an array for intersect
    gun.tags = getTags
    gun.link = doubleLink //like a set to the 'child'/'prev' this also creates a back link on the child back to 'parent'/'next'
    gun.unlink = doubleUnlink//opposite of link
    gun.archive = archive
    gun.unarchive = unarchive
    gun.delete = deleteNode

    gun.massNewPut = massNewPut
    gun.linkImport = linkImport
}

//utility helpers
function linkImport(nextType, linkProp, prevType, keyProp){
    gun = this.back(-1)
    let next = new Promise( (resolve, reject) => {
        let lookup = gun.get('!TYPE/' + nextType).then()
        resolve(lookup)
    })
    let prev = new Promise( (resolve, reject) => {
        let lookup = gun.get('!TYPE/' + prevType).then()
        resolve(lookup)
    })
    Promise.all([next, prev])
        .then(function(res){
            // let filtered = []
            // for (let i = 0; i < res.length; i++) {
            //     const setNode = res[i];
            //     for (const key in setNode) {
            //         const value = setNode[key];
            //         if (value !== null && key !== '_'){
            //             if (!Array.isArray(filtered[i])){
            //                 filtered[i] = []
            //             }
            //             filtered[i].push(key)
            //         }
            //     }
            // }
            // console.log(filtered)
            Promise.all(res.map(function(collection) {
                return fetchGunCollection(Object.keys(collection));
            }))
            .then(result => {
                console.log(result)
            });    
        })
    
    // let prev = new Promise( (resolve, reject) => {
    //     let lookup = gun.get('!TYPE/' + prevType).then()
    //     let keys = Object.keys(lookup)
    //     resolve(keys)
    // }).then( (prevKeys)=> {
    //     next.then( (nextKeys)=> {

    //     })
    // })
    
}
function fetchGunCollection(arr) {
    return Promise.all(arr.map(function(item) {
        return fetchGunKey(item);
    }));    
}

function fetchGunKey(key) {

    return new Promise( (resolve, reject) => {
        let lookup = gun.get(key).then()
        resolve(lookup)
        }) 
}

function massNewPut(state, putString, setString, data, failedArr, idObj) {
	let gun = this;

	switch(state) {
		case 0:
			console.log('start');
			var tempIdObj = {};
			for(let i = 0; i < data.length; i++) {
				// if(i && (i % 50 == 0)) {
				//   localStorage.clear();
				// }
                let newNode = gun.newNode(putString)
                let id = newNode['_']['soul'].split('/')[1]
				data[i]._importId = id;
				tempIdObj[data[i]._importId] = 0;

				newNode.settle(data[i]);



				if(i == (data.length - 1)) {
					console.log(id);
					gun.massNewPut(1, putString, setString, data, [], tempIdObj);
				}
			}
			break;
		case 1:
			console.log('put 1');
			setTimeout(function() {
				for(let i = 0; i < data.length; i++) {
			        // if(i && (i % 50 == 0)) {
			        //     localStorage.clear();
			        // }
			          
			        var getString = putString + '/' + data[i]._importId;
			        let exist
			      	gun.get(getString).on(function(thing) {
			        	exist = thing;
			        });

			        if(!exist) {
			    	    failedArr.push(data[i]);
			        }

			        if(i == (data.length - 1)) {			            
			            gun.massNewPut(2, putString, setString, data, failedArr, idObj);
			        }
			    }
			}, 5000);
		    break;
		case 2:
			console.log('put 2');
			console.log(failedArr.length);
			if(failedArr.length == 0) {
				console.log('put done');
				//gun.massSet(0, putString, setString, data, idObj);
			}
			else {
				for(let i = 0; i < failedArr.length; i++) {
					// if(i && (i % 50 == 0)) {
					// 	localStorage.clear();
					// }
				  
					var getString = putString + '/' + failedArr[i]._importId;

					gun.get(getString).put(failedArr[i]);


					if(i == (failedArr.length - 1)) {
						gun.massNewPut(1, putString, setString, data, [], idObj);
					}
				}
			}
			break;
		case 4: 
			console.log(gun);
			break;
	}
}
function settle(newData) {
    let gun = this;
    let gunRoot = this.back(-1);
    let nodeID = gun['_']['soul'].split('/')[1] || newData['!ID'] || null//or ID string
    let type = gun['_']['soul'].split('/')[0] || newData['!TYPE'] || null
    let nodeSoul = gun['_']['soul']//gun id 'get' string
    
    //run newData through ajv?
    let check = new Promise( (resolve, reject) => {
        let exist = gun.then()
        resolve(exist)
    })
    check.then( (oldData) => {
        if (oldData){
            if(!nodeTypes[type]){
                if(oldData['!TYPE']){
                    if(!nodeTypes[oldData['!TYPE']]){
                        return console.log('INVALID NODETYPE')
                    }else{
                        type = oldData['!TYPE']
                    }
                }else{
                    return console.log('INVALID NODETYPE')
                }
            }
            //if the node already exists
            let result = nodeTypes[type].settle(newData,oldData)
            for(const key in result.putObj){
                if(!nodeTypes[type].whereTag.includes(key)){//skip tag fields, tags() handles this
                    gun.get(key).put(result.putObj[key])
                }
            }
            handleTags(gun, result, type)
        }else{
            if(!nodeTypes[type]){return console.log('INVALID NODETYPE')}
            //for a new node
            gun.get('!ID').put(nodeID)
            gunRoot.get('!TYPE/'+type).get(nodeSoul).put({'#':nodeSoul}) //setlist collection of same type nodes
            if (nodeTypes[type].uniqueFields){
                let fields = nodeTypes[type].uniqueFields
                for (let i = 0; i < fields.length; i++) {
                    let num
                    let gs = '!TYPE/'+ type + '/uniqueFields'
                    let field = Object.keys(fields[i])[0]
                    if (!newData[field]){
                        num = new Promise( (resolve, reject) => {
                        let data = gunRoot.get(gs).get(field).then()
                        resolve(data)
                        })
                        num.then( (curNum) => {
                            if (curNum){
                                gun.get(field).put(curNum)
                                curNum++
                                gunRoot.get(gs).get(field).put(curNum)
                            }else{
                                curNum = nodeTypes[type].uniqueFields[i][field].start
                                gun.get(field).put(curNum)
                                curNum++
                                gunRoot.get(gs).get(field).put(curNum)
                            }
                        })
                    }
                }
            }
            let result = nodeTypes[type].settle(newData,false)
            for(const key in result.putObj){
                if(!nodeTypes[type].whereTag.includes(key)){//skip tag fields, tag() handles this
                    gun.get(key).put(result.putObj[key])
                }
            }
            handleTags(gun, result, type) 
        }
    })
    return gunRoot.get(nodeSoul)
}
function doubleLink(target){//intended to be used in place of .set. Target should be a gun.get("nodeType/00someID00")
    let gun = this;
    let fromProp = gun['_']['get'] || false//gun id last 'get', should be a prop of a known nodeType
    let nodeSoul = gun['_']['soul'] || false //should be undefined > false if they 'get' to a setlist node
    if(nodeSoul){
        return console.log('Must select a property of a node with known nodeType, not the node itself. ie; .get("nodeType/00someID00").get("property").link(node)')}
    let check = new Promise( (resolve, reject) => {
        let exist =  gun.back().then()
        resolve(exist)
    })
    let targetProm = new Promise( (resolve, reject) => {
        let exist =  target.then()
        resolve(exist)
    })
    check.then( (fromNode) => {
        if (fromNode){
            if(!fromNode[fromProp] || typeof fromNode[fromProp] !== 'object' || fromNode[fromProp] === null){gun.put({})}
            let parentType = fromNode['!TYPE']
            let parentNodeSoul = Gun.node.soul(fromNode)
            if(!nodeTypes[parentType]){return console.log('INVALID NODETYPE')}
            targetProm.then( (targetNode) => {
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
                    return console.log('TARGET NODE DOES NOT EXIST')
                }
            })  
        }else{
            //no data
            return console.log('FROM NODE DOES NOT EXIST')
        }
    })
    return gun
}
function doubleUnlink(target){//intended to be used in place of .set. Target should be a gun.get("nodeType/00someID00")
    let gun = this;
    let fromProp = gun['_']['get'] || false//gun id last 'get', should be a prop of a known nodeType
    let nodeSoul = gun['_']['soul'] || false //should be undefined > false if they 'get' to a setlist node
    if(nodeSoul){return console.log('Must select a property of a node with known nodeType, not the node itself. ie; .get("nodeType/00someID00").get("property").link(node)')}
    let check = new Promise( (resolve, reject) => {
        let exist =  gun.back().then()
        resolve(exist)
    })
    let targetProm = new Promise( (resolve, reject) => {
        let exist =  target.then()
        resolve(exist)
    })
    check.then( (fromNode) => {
        if (fromNode){
            if(!fromNode[fromProp] || typeof fromNode[fromProp] !== 'object' || fromNode[fromProp] === null){gun.put({})}
            let parentType = fromNode['!TYPE']
            let parentNodeSoul = Gun.node.soul(fromNode)
            if(!nodeTypes[parentType]){return console.log('INVALID NODETYPE')}
            targetProm.then( (targetNode) => {
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
                        let targetNextProp = Object.keys(nodeTypes[targetType]['next'])[0] //should only ever be a sinlge next key
                        if(!target[targetNextProp] || typeof target[targetNextProp] !== 'object' || target[targetNextProp] === null){target.get(targetNextProp).put({})}
                        //correct orientation was entered
                        gun.get(targetNodeSoul).put(null) //set
                        target.get(targetNextProp).get(parentNodeSoul).put(null)//double set
                        }
                }else{
                    //no data
                    return console.log('TARGET NODE DOES NOT EXIST')
                }
            })  
        }else{
            //no data
            return console.log('FROM NODE DOES NOT EXIST')
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
    if(!fromNodeSoul){
        return console.log('Must select a node with known nodeType. ie; gun.get("nodeType/654someID123").delete()')}
    let check = new Promise( (resolve, reject) => {
        let exist = gun.then()
        resolve(exist)
    })
    check.then( (data) => {
        let fromType = data['!TYPE']
        let nextKey = Object.keys(nodeTypes[fromType]['next'])[0] //should only ever be a sinlge next key
        let prevKeys = Object.keys(nodeTypes[fromType]['prev'])
        gun.get(nextKey).on( (ids) => {
                for (const key in ids) {
                    if(ids[key] !== null){
                        gun.get(key).unlink(gunRoot.get(fromNodeSoul))
                    }
                }
            })
        for (let i = 0; i < prevKeys.length; i++) {
            const prop = prevKeys[i];
            gun.get(prop).on(function(ids){
                for (const key in ids) {
                    if(ids[key] !== null){
                        gun.get(fromNodeSoul).unlink(gunRoot.get(key))
                    }
                }
            })
        }



        // gun.once(function(archiveNode){//null out fields
        //     let type = archiveNode['!TYPE']
        //     gunRoot.get('!TYPE/'+type+'/ARCHIVED').get(fromNodeSoul).put(null)
        //     gunRoot.get('!TYPE/'+type+'/DELETED').get(fromNodeSoul).put({'#': fromNodeSoul})
        //     for (const key in archiveNode) {
        //         if(key !== '_' || key !== '!DELETED'){//otherwise we break things
        //             gun.get(key).put(null)
        //         }
        //     }
            
        // })
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
    let check = new Promise( (resolve, reject) => {
        let exist = gun.then()
        resolve(exist)
    })
    check.then( (data) => {
        let type = data['!TYPE']
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
    })
};
function untag(gun, tag, prop) {
    if(!tag || typeof tag !== 'string' ) { return };
    let gunRoot = gun.back(-1);
    let nodeSoul = gun['_']['soul']

    let check = new Promise( (resolve, reject) => {
        let exist = gun.then()
        resolve(exist)
    })
    check.then( (data) => {
        let type = data['!TYPE']
        //first 3 will be used for data retrieval in the UI
        gunRoot.get('!TAGS/' + tag).get(nodeSoul).put(null);//get nodes of all types with any tag 'tag' (ignore which prop or 'scope')
        gunRoot.get('!TAGS/' + prop).get(tag).get(nodeSoul).put(null);//get nodes of all types with a scoped tag 'prop' with tag 'tag'
        gunRoot.get('!TAGS/' + type + '/' + prop).get(tag).get(nodeSoul).put(null);//get nodes of specific type with a scoped tag 'prop' with tag 'tag'
        //set tag state on node, 1 means current tag, 0 means tag was removed
        gun.get(prop).get(tag).put(0).on(e=> console.log(e));
    })
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
        
        switch (keys.length) {//number of keys in tag query object
            case 3:
                let check = new Promise( (resolve, reject) => {
                    let newKeys = gun.get('!TAGS/' + tags.type + '/' + tags.scope).get(tags.tag).then()
                    
                    resolve(newKeys)
                })
                check.then( (ids) => {
                    for (const key in ids) {
                        if(ids[key] !== null){
                            newKeys[key] = {'#':key}
                        }
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
                })
                break;
            case 2:
                if(keys.includes('tag')&&keys.includes('scope')){
                    let check = new Promise( (resolve, reject) => {
                        let newKeys = gun.get('!TAGS/' + tags.scope).get(tags.tag).then()
                        
                        resolve(newKeys)
                    })
                    check.then( (ids) => {
                        for (const key in ids) {
                            if(ids[key] !== null){
                                newKeys[key] = {'#':key}
                            }
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
                    })
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
                    let check = new Promise( (resolve, reject) => {
                        let newKeys = gun.get('!TYPE/' + tags.type).then()
                        
                        resolve(newKeys)
                    })
                    check.then( (ids) => {
                        for (const key in ids) {
                            if(ids[key] !== null){
                                newKeys[key] = {'#':key}
                            }
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
                    })
                }
                if (keys.includes('scope')) {
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
                    let check = new Promise( (resolve, reject) => {
                        let newKeys = gun.get('!TAGS/' + tags.tag).then()
                        
                        resolve(newKeys)
                    })
                    check.then( (ids) => {
                        for (const key in ids) {
                            if(ids[key] !== null){
                                newKeys[key] = {'#':key}
                            }
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
                    })
                }
                break;
        
            default:
                break;
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
    if(tags.hasOwnProperty('type') && !tags.hasOwnProperty('scope')){
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
    if(tag.hasOwnProperty('type') && !tag.hasOwnProperty('scope')){
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
function assembleTree(gun, node, fromID, archived, max, inc, arr){
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
                    if(!archived && node['!DELETED']){
                        
                    }else{
                        subthings.push(node)
                        let newObj = Object.assign({}, node)
                        let nodeInfo = {data: newObj,
                                        from: fromID,
                                        prop: refsToTraverse[i]}
                        let arrObj = Object.assign({}, idRef, nodeInfo)
                        arr[inc].push(arrObj)
                    }
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
                assembleTree(gun, nextLevel, idRef.id, archived, max, inc, arr);//fires for each prop with refs, and once for each ref on said prop
                }
            }
        }
    }
    //accumulate math?
    return res; // Should return the full tree
}
function reduceRight(treeArr, method , acc){
    acc = acc || false //accumulate all mapper returns to single value, if false, will tree reduce
    let reduced = 0
    let calcArr = JSON.parse(JSON.stringify(treeArr))//?
    treeArr.push(calcArr)
    for (let i = calcArr.length-1; i > -1; i--){
        for (let j = 0; j < calcArr[i].length; j++){
            let node = (calcArr[i][j].data) ? calcArr[i][j].data : calcArr[i][j]//?
            let fromID = calcArr[i][j].from
            let fromProp = calcArr[i][j].prop
            if(node && !node['!DELETED']){
                let mapper = nodeTypes[node['!TYPE']]["methods"][method]
                let res = mapper(node)
                reduced += res
                console.log(calcArr[i][j])
                calcArr[i][j].data = res//?
                //let parent = _.find(calcArr[i-1], ['id', fromID])
                let parent = (calcArr[i-1]) ? calcArr[i-1].find(function(i){
                    return i.id == fromID
                }) : undefined
                if(!parent){
                    console.log(reduced)
                    treeArr = res
                }else{
                    if(typeof parent.data[fromProp] !== 'number'){//if it is a ref, replace with first value
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
function generateTreeObj(startNodeID, max, archived){
    let gun = this.back(-1)
    archived = archived || false
    if (startNodeID['_']['$']){startNodeID = startNodeID['_']['soul']}
	let parentNode
	gun.get(startNodeID).on(e => parentNode = Gun.obj.copy(e))
    let tree = assembleTree(gun, parentNode, startNodeID, archived, max)//?
    return tree[0]
}
function generateTreeArr(startNodeID, max, archived){
    let gun = this.back(-1)
    archived = archived || false
    if (startNodeID['_']['$']){startNodeID = startNodeID['_']['soul']}
	let parentNode
	gun.get(startNodeID).on(e => parentNode = Gun.obj.copy(e))
    let tree = assembleTree(gun, parentNode, startNodeID, archived, max)//?
    return tree[1]
}
function treeReduceRight(startNodeID, method, acc, max){
    let gun = this.back(-1)
    if (startNodeID['_']['$']){startNodeID = startNodeID['_']['soul']}
	let parentNode
	gun.get(startNodeID).on(e => parentNode = Gun.obj.copy(e))
    let tree = assembleTree(gun, parentNode, startNodeID, false, max)//?
    let methodCalc = reduceRight(tree[1], method, acc)
    return methodCalc
}

//Tree Logic
