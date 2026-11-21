// Generic, non-blocking, single-screen messages. No learner event/action Blocks.
namespace messages {
    class Entry {
        until = 0
        constructor(public text: string, public duration: number) {}
    }
    let notifications: Entry[] = []
    let announcements: Entry[] = []

    function valueText(value: string | number | shooter.Player): string {
        if (value == null) return ""
        if (value instanceof shooter.Player) return shooter.getDisplayName(value)
        return "" + value
    }

    /** Replace up to three {} placeholders; extra placeholders remain literal. */
    export function text(template: string, a: string | number | shooter.Player = null, b: string | number | shooter.Player = null, c: string | number | shooter.Player = null): string {
        const values = [valueText(a), valueText(b), valueText(c)]
        let result = ""
        let slot = 0
        for (let i = 0; i < template.length; i++) {
            if (template.charAt(i) == "{" && template.charAt(i + 1) == "}" && slot < 3) {
                result += values[slot++]
                i++
            } else result += template.charAt(i)
        }
        return result
    }

    function visible(target: shooter.Player | shooter.Team): boolean {
        if (!target) return true
        if (target instanceof shooter.Player) return shooter.isHuman(target)
        const players = shooter.allPlayers()
        for (let i = 0; i < players.length; i++) if (shooter.isHuman(players[i])) return shooter.getTeam(players[i]) == target
        return target == shooter.teamById(0)
    }

    function enqueue(queue: Entry[], text: string, duration: number, target: shooter.Player | shooter.Team): void {
        if (!visible(target) || !text.length) return
        // Preserve the current entry; discard the oldest waiting entry on overflow.
        if (queue.length >= 8) queue.removeAt(1)
        const entry = new Entry(text.substr(0, 180), duration)
        if (!queue.length) entry.until = game.runtime() + duration
        queue.push(entry)
    }

    export function notify(text: string, target: shooter.Player | shooter.Team = null): void {
        enqueue(notifications, text, 1800, target)
    }

    export function announce(text: string, target: shooter.Player | shooter.Team = null): void {
        enqueue(announcements, text, 2400, target)
    }

    function advance(queue: Entry[], now: number): void {
        if (!queue.length || now < queue[0].until) return
        queue.removeAt(0)
        if (queue.length) queue[0].until = now + queue[0].duration
    }

    // Engine integration: called once per update, never pauses gameplay.
    export function update(now: number): void {
        advance(notifications, now)
        advance(announcements, now)
    }

    function lines(text: string, width: number, limit: number): string[] {
        const result: string[] = []
        while (text.length && result.length < limit) {
            let end = Math.min(width, text.length)
            if (end < text.length) {
                for (let i = end; i > 0; i--) if (text.charAt(i) == " ") { end = i; break }
            }
            result.push(text.substr(0, end))
            text = text.substr(end)
            while (text.charAt(0) == " ") text = text.substr(1)
        }
        return result
    }

    export function draw(target: Image): void {
        if (notifications.length) {
            const rows = lines(notifications[0].text, 30, 2)
            target.fillRect(0, 10, 160, rows.length * 7 + 2, 15)
            for (let i = 0; i < rows.length; i++) target.print(rows[i], 3, 11 + i * 7, 1, image.font5)
        }
        if (announcements.length) {
            const rows = lines(announcements[0].text, 18, 3)
            const top = 56 - rows.length * 5
            target.fillRect(3, top - 3, 154, rows.length * 10 + 6, 15)
            for (let i = 0; i < rows.length; i++) target.print(rows[i], 80 - rows[i].length * 4, top + i * 10, 5, image.font8)
        }
    }
}
