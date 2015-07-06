var express = require('express'),
    router = express.Router(),
    Auth = require('../../controllers/auth'),
    Error = require('../../controllers/error'),
    MasterController = require('../../controllers/master'),
    entities = require("../entityConfig");

//This route is for getting a list of results for the specified entity
//url parameters can be used to add filtering
//Requires 'read' permission on the specified entity
router.get("/:entity", Auth.isLoggedIn, function(req, res){
  var queryObj = parseQuery(req.query || {}, req.body || {}, "GET", entities[req.params.entity]);
  var query = queryObj.query;
  var entity = queryObj.entity;
  var user = req.user;
  var userPermissions;
  if(req.user){
    userPermissions = req.user.role.permissions[req.params.entity];
  }
  //check that the user has sufficient permissions for this operation
  if((!userPermissions || userPermissions.read!=true) && entity.requiresAuthentication){
    res.json(Error.insufficientPermissions);
  }
  else{
    if((userPermissions && userPermissions.allOwners!=true) && entity.exemptFromOwnership!=true && !entity.requiresAuthentication){
      query['createuser']=user._id;
    }
    MasterController.get(req.query, query, entity, function(results){
      res.json(results || {});
    });
  }
});

//This route is for getting a count of results for the specified entity
//url parameters can be used to add filtering
//Requires 'read' permission on the specified entity
router.get("/:entity/count", Auth.isLoggedIn, function(req, res){
  var queryObj = parseQuery(req.query || {}, req.body || {}, "GET", entities[req.params.entity]);
  var query = queryObj.query;
  var entity = queryObj.entity;
  var user = req.user;
  var userPermissions;
  //check that the user has sufficient permissions for this operation
  if(req.user){
    userPermissions = req.user.role.permissions[req.params.entity];
  }
  //check that the user has sufficient permissions for this operation
  if((!userPermissions || userPermissions.read!=true) && entity.requiresAuthentication){
    res.json(Error.insufficientPermissions);
  }
  else{
    if((userPermissions && userPermissions.allOwners!=true) && entity.exemptFromOwnership!=true && !entity.requiresAuthentication){
      query['createuser']=user._id;
    }
    console.log(query);
    MasterController.count(req.query, query, entity, function(results){
      res.json(results||{});
    });
  }
});

//This route is for getting a specific result from the specified entity
//url parameters can be used to add filtering
//Requires 'read' permission on the specified entity
router.get("/:entity/:id", Auth.isLoggedIn, function(req, res){
  var queryObj = parseQuery(req.query || {}, req.body || {}, "GET", entities[req.params.entity]);
  var query = queryObj.query;
  var entity = queryObj.entity;
  query["_id"] = req.params.id;
  var user = req.user;
  var userPermissions;
  //check that the user has sufficient permissions for this operation
  if((!userPermissions || userPermissions.read!=true) && entity.requiresAuthentication){
    res.json(Error.insufficientPermissions);
  }
  else{
    if((userPermissions && userPermissions.allOwners!=true) && entity.exemptFromOwnership!=true && !entity.requiresAuthentication){
      query['createuser']=user._id;
    }
    MasterController.get(req.query, query, entity, function(results){
      res.json(results || {});
    });
  }
});

//This route is for creating a new record on the specified entity and returning the new record
//Requires 'create' permission on the specified entity
router.post("/:entity/", Auth.isLoggedIn, function(req, res){
  var entity = req.params.entity;
  var user = req.user;
  var userPermissions = req.user.role.permissions[entity];
  var data = req.body;
  if(!userPermissions || userPermissions.create!=true){
    res.json(Error.insufficientPermissions);
  }
  else{
    data.createuser = user._id;
    MasterController.save(null, data, entities[entity], function(result){
      res.json(result);
    });
  }
});


//This route is for saving a specific record on the specified entity
//url parameters can be used to add filtering
//Requires 'update' permission on the specified entity
router.post("/:entity/:id", Auth.isLoggedIn, function(req, res){
  var query = req.query || {};
  query["_id"] = req.params.id;
  var entity = req.params.entity;
  var user = req.user;
  var userPermissions = req.user.role.permissions[entity];
  var data = req.body;
  console.log(userPermissions);
  //check that the user has sufficient permissions for this operation
  if(!userPermissions || userPermissions.update!=true){
    res.json(Error.insufficientPermissions);
  }
  else{
    if(userPermissions.allOwners!=true && !entities[entity].exemptFromOwnership){
      query['createuser']=user._id;
    }
    MasterController.get(req.query, query, entities[entity], function(response){    //This ensures that users can only update records they own (where applicable)
      if(response.data.length > 0){
        MasterController.save(query, data, entities[entity], function(result){
          res.json(result);
        });
      }
      else{
        res.json(Error.noRecord);
      }
    });
  }
});

//This route is for deleting a list of records on the specified entity
//url parameters can be used to add filtering
//Requires 'delete' permission on the specified entity
router.delete("/:entity", Auth.isLoggedIn, function(req, res){
  var query = req.query || {};
  var entity = req.params.entity;
  var user = req.user;
  var userPermissions = req.user.role.permissions[entity];
  if(!userPermissions || userPermissions.delete!=true){
    res.json(Error.insufficientPermissions);
  }
  else{
    if(userPermissions.allOwners!=true){
      query['createuser']=user._id;
    }
    MasterController.delete(query, entities[entity], function(result){
      res.json(result);
    });
  }
});

//This route is for deleting a specific record on the specified entity
//url parameters can be used to add filtering
//Requires 'delete' permission on the specified entity
router.delete("/:entity/:id", Auth.isLoggedIn, function(req, res){
  var query = req.query || {};
  query["_id"] = req.params.id;
  var entity = req.params.entity;
  var user = req.user;
  var userPermissions = req.user.role.permissions[entity];
  if(!userPermissions || userPermissions.delete!=true){
    res.json(Error.insufficientPermissions);
  }
  else{
    if(userPermissions.allOwners!=true){
      query['createuser']=user._id;
    }
    MasterController.delete(query, entities[entity], function(result){
      res.json(result);
    });
  }
});

//this function parses any sorting or paging parameters and contstructs the mongodb query accordingly.
//Currently only used for GET requests
function parseQuery(query, body, method, originalEntity){
  var entity = cloneObject(originalEntity);
  var mongoQuery = {};
  query = query || {};
  body = body || {};
  if(query.sort){
    var sort = {};
    sort[query.sort] = query.sortOrder || 1;
    entity.sort = sort;
    delete query["sort"];
    delete query["sortOrder"];
  }
  entity.skip = query.skip || entity.skip || 0;
  entity.limit = query.limit || entity.limit || 0;
  delete query["skip"];
  delete query["limit"];

  if(method=="GET"){
    query = concatObjects([query, body]);
  }

  mongoQuery.entity = entity;
  mongoQuery.query = query;

  return mongoQuery;
}

function cloneObject(object){
  var clone = {};
  for (var key in object){
    clone[key] = object[key];
  }
  return clone;
}

function concatObjects(objects){
  var result = {};
  for (var o in objects){
    for (var key in objects[o]) result[key]=objects[o][key];
  }
  return result;
}

module.exports = router;
