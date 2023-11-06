---
{"dg-publish":true,"permalink":"/my-obsidian-workflow/","title":"My Obsidian workflow","tags":["systems"],"noteIcon":"","created":"2022-12-12"}
---


I try to hold myself back from going too far down the rabbit hole of trying out too many different apps in search of the "perfect" one, to avoid [[Procrastination through process\|Procrastination through process]]. But I had a few specific things I wanted for this website: 

1. A markdown editor to write and edit notes
2. To be able to push what I've written live to my site
3. To be able to do these things on a laptop, iPad or even on my phone

The last point, being able to complete the whole process on a mobile device, is important to me because I try my best to not open my laptop once I've closed it at the end of my work day. As someone who works from home, in their bedroom, I need to have some separation between work and hobbies (some of which do somewhat resemble my work, which makes the distinction even harder). 

My other cross-platform note-taking tools, Bear and Notion, aren't great at opening existing files and editing where it exists - they just create a new copy in their own system. VSCode is serving me well for any bits of coding I need to do, but there isn't an equivalent app for mobile devices.

The solution I've found is [Obsidian](https://obsidian.md/), a note-taking app that's really built around a knowledge management system workflow and is also very extendable through community plugins. It's not quite as slick a writing experience as Bear, and not quite as powerful as Notion, but it does allow me to open my website files (stored in iCloud) as a "vault" of notes that I can edit and publish using a plugin.

![Screenshot of Obsidian interface, showing this post](/img/user/assets/screenshot-of-obsidian.png)
###### A screenshot of this post in Obsidian. How meta!

## Here's my workflow for adding a new notes at the moment:

1. Fire up Obsidian and start a new note, which I've set up to add to the correct folder.
2. Insert a template containing the standard frontmatter using the hotkey command I set up for it. This includes a "share: false" line which I can change when I'm ready to publish.
3. Write the thing, using some nice inbuilt Markdown bits and internal links.
4. Change to "dg-publish: true" in the frontmatter.
5. Use a hotkey command to run the [Obsidian Github Publisher plugin](https://github.com/ObsidianPublisher/obsidian-github-publisher), which will look for any new or edited notes with  "dg-publish: true" and send them off to Github.

There's a few quirks and it did take me some time to get it to this state, but in the end it's pretty much what I was after. I imagine this will be an evolving situation...
