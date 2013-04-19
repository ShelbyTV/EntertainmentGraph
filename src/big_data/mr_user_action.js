//------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------MR UserActions -> Video Actions----------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/* Timing */
var start = new Date();
print("mr_user_action.js -- Starting at "+start);
/* End Timing */

// Goal of this Map Reduce:
//  For a given video_id, end up with an object tracking
//  all Shelby users that performed a target action
// NB: storing user id's as String for faster comparison down the road (native indexOf() uses === but ObjectId's need .equals() for correct comparisson)

// Example mapping from a single UserAction:
//  Key = <VIDEO_ID>
//  Value = { a1: [<USER_ID_STR>], a8: [], a9: [], a11: [] }
var mapUserActions = function(){
  // UserAction.d stores video_id
  //
  // UserAction.a stores the action type
  // 1=view, 8=like, 9=roll, 11=complete watch
  //
  // UserAction.b stores the user_id
  //
  if(this.d && this.b && (this.a == 1 || this.a == 8 || this.a == 9 || this.a == 11)){
    var value = {
      a1:  [],
      a8:  [],
      a9:  [],
      a11: []
    };
    
    //NB: use this.b.valueOf() when running on mongo 2.2+
    //NB: even if console is 2.2+, when connecting to mongod < 2.2 need to use .toString()
    value['a'+this.a].push(this.b.toString());
    
    emit(this.d, value);
  }
};

// Example reduce:
//  Key = <VIDEO_ID>
//  Value = { a1:  [U1, U2, U3, U4, ...],      <- viewers
//            a8:  [U1, U9, ...],              <- likers
//            a9:  [U1, U2, U11, U12, ...]     <- rollers
//            a11: [U1, U2, U3, ...] }         <- complete watchers
var reduceUserActions = function(videoId, values){
  var reducedValue = {
    a1:  [],
    a8:  [],
    a9:  [],
    a11: []
  };
  
  for(var i = 0; i < values.length; i++){
    reducedValue.a1 = reducedValue.a1.concat(values[i].a1);
    reducedValue.a8 = reducedValue.a8.concat(values[i].a8);
    reducedValue.a9 = reducedValue.a9.concat(values[i].a9);
    reducedValue.a11 = reducedValue.a11.concat(values[i].a11);
  }
  
  return reducedValue;
};


var daysAgoId = ObjectId((Math.floor((new Date())/1000) - 5*24*60*60).toString(16) + "0000000000000000");
db.user_actions.mapReduce( mapUserActions, reduceUserActions, {
  query: {_id:{$gt: daysAgoId}, a: {$in:[1,8,9,11]} },
  out: {
    replace: 'mr__video_actions',
    nonAtomic: true
  }
});


/* Timing */
var end = new Date();
var dur = end-start;
print("mr_user_action.js -- Completed at "+end);
print("mr_user_action.js -- Duration: "+dur/60000+"m");
/* End Timing */
