// Tilemap navigation shared by soldiers. A separate distance field per target
// lets several bots pursue different soldiers without overwriting each other's routes.
namespace pathing {
    let columns = 0
    let rows = 0
    let tileSize = 16

    export function size(): number { return tileSize }
    export function width(): number { return columns }
    export function height(): number { return rows }

    export function loadMap(): void {
        const map = game.currentScene().tileMap
        columns = map && map.data ? map.data.width : 0
        rows = map && map.data ? map.data.height : 0
        tileSize = columns > 0 ? 1 << map.scale : 16
    }

    export function walkable(column: number, row: number): boolean {
        return column >= 0 && row >= 0 && column < columns && row < rows
            && !tiles.tileAtLocationIsWall(tiles.getTileLocation(column, row))
    }

    /** Clear a cardinal shot's two-pixel-wide corridor, not just its center line. */
    export function clearLine(x0: number, y0: number, x1: number, y1: number): boolean {
        if (x0 != x1 && y0 != y1) return false
        const length = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
        const steps = Math.max(1, Math.ceil(length / 2))
        for (let i = 0; i <= steps; i++) {
            const x = x0 + (x1 - x0) * i / steps
            const y = y0 + (y1 - y0) * i / steps
            for (let side = -1; side <= 1; side += 2) {
                const sx = x + (x0 == x1 ? side : 0)
                const sy = y + (y0 == y1 ? side : 0)
                if (!walkable(Math.floor(sx / tileSize), Math.floor(sy / tileSize))) return false
            }
        }
        return true
    }

    export class Field {
        goal = -1
        distances: number[] = []
        private nextRefreshAt = 0
        private targetId = -1

        constructor() {}

        reachable(column: number, row: number): boolean {
            return walkable(column, row) && this.distances[row * columns + column] >= 0
        }

        /** Rebuild at most four times per second; force on spawn or target replacement. */
        refresh(target: Sprite, now: number, force: boolean = false): void {
            if (!force && target.id == this.targetId && now < this.nextRefreshAt) return
            this.nextRefreshAt = now + 250
            this.targetId = target.id
            loadMap()
            this.distances = []
            for (let i = 0; i < columns * rows; i++) this.distances.push(-1)
            const column = Math.floor(target.x / tileSize)
            const row = Math.floor(target.y / tileSize)
            this.goal = -1
            if (!walkable(column, row)) return
            this.goal = row * columns + column
            this.distances[this.goal] = 0
            const queue: number[] = [this.goal]
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
                    if (this.distances[next] < 0 && walkable(next % columns, Math.idiv(next, columns))) {
                        this.distances[next] = this.distances[cell] + 1
                        queue.push(next)
                    }
                }
            }
        }
    }

    /** One 8x8-or-smaller soldier. Finish cardinal waypoints before turning. */
    export class Bot {
        private waypoint = -1

        constructor(public sprite: Sprite, public speed: number) {}

        private steer(x: number, y: number): void {
            const dx = x - this.sprite.x
            const dy = y - this.sprite.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            if (distance < 0.1) return
            const velocity = Math.min(this.speed, distance * 15)
            this.sprite.vx = dx / distance * velocity
            this.sprite.vy = dy / distance * velocity
        }

        update(target: Sprite, field: Field): void {
            this.sprite.vx = 0
            this.sprite.vy = 0
            if (columns == 0 || field.goal < 0) return
            const column = Math.floor(this.sprite.x / tileSize)
            const row = Math.floor(this.sprite.y / tileSize)
            if (!field.reachable(column, row)) {
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
            if (cell == field.goal) {
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
                if (Math.abs(next % columns - cell % columns) + Math.abs(Math.idiv(next, columns) - Math.idiv(cell, columns)) != 1) continue
                if (field.reachable(next % columns, Math.idiv(next, columns)) && field.distances[next] < field.distances[cell]) {
                    this.waypoint = next
                    this.steer((next % columns + 0.5) * tileSize, (Math.idiv(next, columns) + 0.5) * tileSize)
                    return
                }
            }
        }
    }
}
