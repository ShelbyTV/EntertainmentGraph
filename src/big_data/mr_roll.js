//------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------- MR Rolls -> Friendships ----------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/* Params */
//  The current preferred method for passing params to a mongo shell script is to set them as variables in the --eval argument
//  of the mongo command, then use them in the script.
//
//  Params for this script are:
//  mrLimit (default 20000000): the maximum number of records to process in the mapReduce - very useful for speeding up for debugging
if (typeof(mrLimit) == 'undefined') {
  mrLimit = 20000000;
}

// Example usage:
// mongo gt-db-roll-frame-s0-a/gt-roll-frame --eval 'var mrLimit=100' ~/EntertainmentGraph/src/big_data/mr_roll.js
/* End Params */

/* Timing */
var start = new Date();
print("mr_roll.js -- Starting at "+start);
/* End Timing */

// Goal of this Map Reduce:
//  For a given user_id, produce a set of friends (ie. creators of rolls followed by user)
//  NB: We do not need "faux" relationships (b/c faux users only action will result in a dashboard entry, which we capture separately)

// Example mapping from each following_user entry in a Roll
//  Key = <USER_ID>
//  Value = { <FRIEND_ID_STR>:1 }
var mapRolls = function(){
  // Roll.a stores roll's creator's user_id (our value)
  // Roll.following_users stores the embedded following users document which stores
  //  following_user.a stores the following user's user_id (our key)

  if(this.following_users){
    for(var i = 0; i < this.following_users.length; i++){
      var value = {};
      // explicitly convert the ObjectId to a string the way we want to
      // by using .valueOf()
      value[this.a.valueOf()] = 1;
      emit(this.following_users[i].a, value);
    }
  }
};

// Reduce fakes set semantics of friends by storing them in objects.
// Example reduce:
//  Key = <USER_ID>
//  Value = { Friend1:1, Friend2:1, Friend3:1, ...}
var reduceRolls = function(userId, values){
  var reducedValue = {},
  key;

  for(var i = 0; i < values.length; i++){
    for(key in values[i]){
      reducedValue[key] = 1;
    }
  }

  return reducedValue;
};


// Map Reduce
// upper limit as of 3/26/13: 36 000 000
// timing                      1 000 000  -- 00:30
//                             5 000 000  -- 04:00-05:00  --non-faux-- 03:28
//                            10 000 000  -- 15:00        --non-faux-- 10:20
//                            20 000 000  --   ?          --non-faux-- 72:00
// NB: the above don't seem to kill performance,
//  but should be run off peak,
//  they're the most expensive things we're running...
//  Seeing increase in lock & page faults on primary when I run this
// NB: Not looking at faux rolls as we only care about "real" friendships
print("Limiting to " + mrLimit + " records");
db.rolls.mapReduce( mapRolls, reduceRolls, {
  query: {n:{$nin:[11,12,13,14]}},
  limit: mrLimit,
  out: {
    replace: 'mr__friendships'
  }
});


/* Timing */
var end = new Date();
var dur = end-start;
print("mr_roll.js -- Completed at "+end);
print("mr_roll.js -- Duration: "+dur/60000+"m");
/* End Timing */

