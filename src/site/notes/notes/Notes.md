---
title: Notes
publish: true
section: writing
date: 2025-11-29
slug: notes
created: 2025-02-19
updated: 2025-11-29
---

I've made a few attempts to take notes for things that I read, hear or have ideas about. These have always been private, but I'm tentatively trying to put them here publicly. 

There is very little that is original here - it is mostly based on various sources. Some notes are extremely brief, which helps keep them atomic. All are opinionated but loosely held. These should evolve over time, if I'm continuing this practice.

```dataview
TABLE WITHOUT ID
    file.link as "Title",
    choice(description, description, "") as "Summary",    
    dateformat(date, "d MMMM yyyy") as "Date Posted"
FROM ""
WHERE publish = true
  AND contains(file.folder, "notes")
SORT date desc
LIMIT 200
```



I've tried to put these into a few broad themes, which can be handy for navigation when I finish putting this together.
```dataview 
LIST without id file.link
WHERE contains(file.tags, "#index")
SORT updated DESC
```