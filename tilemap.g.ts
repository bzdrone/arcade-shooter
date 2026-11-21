// Auto-generated code. Do not edit.
namespace myTiles {
    //% fixedInstance jres blockIdentity=images._tile
    export const transparency16 = image.ofBuffer(hex``);
    //% fixedInstance jres blockIdentity=images._tile
    export const yardFloor = image.ofBuffer(hex``);
    //% fixedInstance jres blockIdentity=images._tile
    export const yardWall = image.ofBuffer(hex``);
    //% fixedInstance jres blockIdentity=images._tile
    export const yardCover = image.ofBuffer(hex``);
    //% fixedInstance jres blockIdentity=images._tile
    export const yardLane = image.ofBuffer(hex``);
    //% fixedInstance jres blockIdentity=images._tile
    export const blueSpawn = image.ofBuffer(hex``);
    //% fixedInstance jres blockIdentity=images._tile
    export const redSpawn = image.ofBuffer(hex``);

    helpers._registerFactory("tilemap", function(name: string) {
        switch(helpers.stringTrim(name)) {
            case "trainingYard":
            case "trainingYard1":return tiles.createTilemap(hex`0a00070002020202020202020202020101010404010101020205010304040101060202010103040403010102020501010404030106020201010104040101010202020202020202020202`, img`
2 2 2 2 2 2 2 2 2 2 
2 . . . . . . . . 2 
2 . . 2 . . . . . 2 
2 . . 2 . . 2 . . 2 
2 . . . . . 2 . . 2 
2 . . . . . . . . 2 
2 2 2 2 2 2 2 2 2 2 
`, [myTiles.transparency16,myTiles.yardFloor,myTiles.yardWall,myTiles.yardCover,myTiles.yardLane,myTiles.blueSpawn,myTiles.redSpawn], TileScale.Sixteen);
        }
        return null;
    })

    helpers._registerFactory("tile", function(name: string) {
        switch(helpers.stringTrim(name)) {
            case "transparency16":return myTiles.transparency16;
            case "yardFloor0":
            case "yardFloor":return myTiles.yardFloor;
            case "yardWall0":
            case "yardWall":return myTiles.yardWall;
            case "yardCover0":
            case "yardCover":return myTiles.yardCover;
            case "yardLane0":
            case "yardLane":return myTiles.yardLane;
            case "blueSpawn0":
            case "blueSpawn":return myTiles.blueSpawn;
            case "redSpawn0":
            case "redSpawn":return myTiles.redSpawn;
        }
        return null;
    })

}
// Auto-generated code. Do not edit.
