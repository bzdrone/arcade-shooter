# Arcade Shooter: your first change

Start by getting comfortable with MakeCode Arcade. Then use this little game to try changing one rule. You do not need to write code for this activity.

## 1. New to MakeCode Arcade? Start here

Open [MakeCode Arcade](https://arcade.makecode.com/) and work through a few of the beginner tutorials on its home page before opening the shooter. These guided activities introduce the editor and show you how to build small games with blocks.

Take your time. Try changing something in each tutorial, not just following the steps.

You are ready to try the shooter when you can:

- Find **Blocks**, the area where you arrange instructions for your game.
- Find the game preview (called the **simulator**) and use its controls to play, stop, and start a game.
- Change a number in a block and see what happens in the game.

### Practice saving and opening a game

Before opening the shooter, try this with one of your finished tutorial games:

1. Make a small change you can recognize, such as changing your character's appearance. Play to check it.
2. Use the **camera button** under the game preview to save a **PNG file**. It may be labelled **Take Screenshot**, but in MakeCode Arcade this saves the editable game inside the picture too. This is different from taking a screenshot with your computer.
3. Find the downloaded `.png` file, usually in your **Downloads** folder. Keep the original file; do not copy just its picture or save it through an image editor.
4. Go to MakeCode Arcade's **Home** page. Choose **Import → Import File** and open that PNG. You do not need to delete your original project.
5. Play the imported game and look at its **Blocks**. Is your change still there? Can you still edit it?

If both are true, you have saved and reopened an editable game. That is the same process you will use to open the shooter—and you can use it later to save your own version.

Already comfortable with the editor and saving and importing project PNGs? Continue below.

## 2. Open the shooter

1. Download **arcade-shooter.png**, the game file supplied with this introduction. Keep the original so you can start over later.
2. Open [MakeCode Arcade](https://arcade.makecode.com/).
3. Choose **Import → Import File** and select the downloaded file. You can also drag the file onto the page.
4. Press **Play** if the game does not start automatically.

Although the file looks like a picture, it contains the game and its editable blocks. You do not need the other source-code downloads.

## 3. Play for a minute

You are the **blue soldier with a white stripe on your helmet**. The other blue soldier is your computer-controlled teammate. The two red soldiers are the other team.

- Use the **arrow keys** to move.
- Hold **Space** to shoot. Your shots go in the direction you last moved.
- Hide behind walls to block shots.

Click inside the game preview first if the keyboard does not respond. You can also use its on-screen direction buttons and **A** button.

If your soldier disappears after being hit, wait a few seconds: you will return. Each defeated soldier earns the other team a point; the first team to 10 wins. You do not need to finish a match before continuing.

## 4. Make each hit stronger

Let's change just one number. Leave the other settings alone for now.

1. Click **Blocks** at the top of the editor if you are not already there.
2. In the blocks already on the workspace, find **set incoming damage percent**. You do not need to add a new block.
3. Change **100** to **200**. A value of 100 means normal damage; 200 doubles the health lost from each hit. Leave maximum health at **100**.
4. Before playing, guess: will a soldier need more hits or fewer hits to be defeated?
5. **Stop** the game preview, then press **Play** to start it again. Use stop and Play rather than the restart button so the game picks up your change.
6. Play again and watch what happens when shots hit.

This change makes hits stronger for **everyone**, including the red team. With the starting settings, it takes three pistol hits to defeat a soldier. After your change, it takes two. Arcade uses simplified weapons; the exact number of hits in Portal depends on its weapons and other experience settings.

To undo the change, set incoming damage percent back to **100**, then stop and play again.

## You changed a game rule

You changed a number, tried the game, and checked what happened. That is enough for a first session.

Want to try another small experiment? Read [Activity 1: Change experience modifiers](https://github.com/bzdrone/arcade-shooter/blob/main/lessons/01-weapon-tuning.md) online. No extra download is needed. Save [writing your own game rules](https://github.com/bzdrone/arcade-shooter/blob/main/lessons/02-mod-rules.md) for later, once you are comfortable changing blocks.

Later, when you are ready to try your map and rules in Battlefield 6 Portal, save your shooter as a project PNG and open the experimental [Arcade to Portal converter](https://bzdrone.github.io/arcade-shooter/). It produces the Portal map edits, rules script, and messages in your browser; nothing is uploaded. It converts the supported shooter maps and rules, not arbitrary MakeCode games.

These instructions are a separate handout; they do not appear inside the game. The game is shared under the [MIT license](https://github.com/bzdrone/arcade-shooter/blob/main/LICENSE).
