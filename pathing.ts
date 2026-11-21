// Shared reverse breadth-first search for small Arcade tilemaps. No extension required.
// Walls are read from the active tilemap: there is no separate navigation layout.
namespace pathing {
    let columns = 0
    let rows = 0
    let tileSize = 8
    let goal = -1
    let distances: number[] = []
    let nextRefreshAt = 0

    export function size(): number { return tileSize }
    export function width(): number { return columns }
    export function height(): number { return rows }

    export function walkable(column: number, row: number): boolean {
        return column >= 0 && row >= 0 && column < columns && row < rows
            && !tiles.tileAtLocationIsWall(tiles.getTileLocation(column, row))
    }

    export function reachable(column: number, row: number): boolean {
        return walkable(column, row) && distances[row * columns + column] >= 0
    }

    /** Rebuild at most four times a second, shared by all bots. Force on startup. */
    export function refresh(target: Sprite, now: number, force: boolean = false): void {
        if (!force && now < nextRefreshAt) return
        nextRefreshAt = now + 250
        const map = game.currentScene().tileMap
        if (!map || !map.data) {
            columns = 0
            rows = 0
            goal = -1
            distances = []
            return
        }
        columns = map.data.width
        rows = map.data.height
        tileSize = 1 << map.scale
        distances = []
        for (let i = 0; i < columns * rows; i++) distances.push(-1)
        const column = Math.floor(target.x / tileSize)
        const row = Math.floor(target.y / tileSize)
        goal = -1
        if (!walkable(column, row)) return
        goal = row * columns + column
        distances[goal] = 0
        const queue: number[] = [goal]
        let head = 0
        while (head < queue.length) {
            const cell = queue[head++]
            const x = cell % columns
            const y = Math.idiv(cell, columns)
            const neighbors = [cell - 1, cell + 1, cell - columns, cell + columns]
            for (let direction = 0; direction < 4; direction++) {
                if (direction == 0 && x == 0 || direction == 1 && x == columns - 1
                    || direction == 2 && y == 0 || direction == 3 && y == rows - 1) continue
                const next = neighbors[direction]
                if (distances[next] < 0 && walkable(next % columns, Math.idiv(next, columns))) {
                    distances[next] = distances[cell] + 1
                    queue.push(next)
                }
            }
        }
    }

    /** One 8x8-or-smaller bot. Finish each cardinal waypoint before turning. */
    export class Bot {
        private waypoint = -1

        constructor(public sprite: Sprite, public speed: number) {}

        private steer(x: number, y: number): void {
            const dx = x - this.sprite.x
            const dy = y - this.sprite.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            if (distance < 0.1) return
            // Ease into centers so large configured speeds don't overshoot corners.
            const velocity = Math.min(this.speed, distance * 15)
            this.sprite.vx = dx / distance * velocity
            this.sprite.vy = dy / distance * velocity
        }

        update(target: Sprite): void {
            this.sprite.vx = 0
            this.sprite.vy = 0
            if (columns == 0 || goal < 0) return
            const column = Math.floor(this.sprite.x / tileSize)
            const row = Math.floor(this.sprite.y / tileSize)
            if (!reachable(column, row)) {
                this.waypoint = -1
                return
            }
            if (this.waypoint >= 0) {
                const wx = this.waypoint % columns
                const wy = Math.idiv(this.waypoint, columns)
                if (!walkable(wx, wy)) {
                    this.waypoint = -1
                    return
                }
                const x = (wx + 0.5) * tileSize
                const y = (wy + 0.5) * tileSize
                if (Math.abs(this.sprite.x - x) > 0.5 || Math.abs(this.sprite.y - y) > 0.5) {
                    this.steer(x, y)
                    return
                }
                this.sprite.setPosition(x, y)
                this.waypoint = -1
            }
            const cell = Math.floor(this.sprite.y / tileSize) * columns + Math.floor(this.sprite.x / tileSize)
            if (cell == goal) {
                // Direct pursuit is safe only while both centers share a walkable cell.
                if (Math.floor(target.x / tileSize) == cell % columns
                    && Math.floor(target.y / tileSize) == Math.idiv(cell, columns)) this.steer(target.x, target.y)
                return
            }
            const centerX = (cell % columns + 0.5) * tileSize
            const centerY = (Math.idiv(cell, columns) + 0.5) * tileSize
            if (Math.abs(this.sprite.x - centerX) > 0.5 || Math.abs(this.sprite.y - centerY) > 0.5) {
                this.waypoint = cell
                this.steer(centerX, centerY)
                return
            }
            this.sprite.setPosition(centerX, centerY)
            const neighbors = [cell - 1, cell + 1, cell - columns, cell + columns]
            for (let i = 0; i < neighbors.length; i++) {
                const next = neighbors[i]
                // Prevent left/right wrapping and reject stale or blocked steps.
                if (Math.abs(next % columns - cell % columns) + Math.abs(Math.idiv(next, columns) - Math.idiv(cell, columns)) != 1) continue
                if (reachable(next % columns, Math.idiv(next, columns)) && distances[next] < distances[cell]) {
                    this.waypoint = next
                    this.steer((next % columns + 0.5) * tileSize, (Math.idiv(next, columns) + 0.5) * tileSize)
                    return
                }
            }
        }
    }
}
