export default async function ({ addon, console, msg }) {
  function makeStyle() {
    let style = document.createElement("style");
    style.textContent = `
    .blocklyText {
        fill: #fff;
        font-family: "Helvetica Neue", Helvetica, sans-serif;
        font-size: 12pt;
        font-weight: 500;
    }
    .blocklyNonEditableText>text, .blocklyEditableText>text {
        fill: #575E75;
    }
    .blocklyDropdownText {
        fill: #fff !important;
    }
    `;
    for (let userstyle of document.querySelectorAll(".scratch-addons-style[data-addons*='editor-theme3']")) {
      if (userstyle.disabled) continue;
      style.textContent += userstyle.textContent;
    }
    return style;
  }

  function setCSSVars(element) {
    for (let property of document.documentElement.style) {
      if (property.startsWith("--editorTheme3-"))
        element.style.setProperty(property, document.documentElement.style.getPropertyValue(property));
    }
  }

  let exSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  exSVG.setAttribute("xmlns:html", "http://www.w3.org/1999/xhtml");
  exSVG.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  exSVG.setAttribute("version", "1.1");

  // blocks-media as base64 for svg inline image
  let blocksMedia = new Map();
  blocksMedia.set(
    "repeat.svg",
    "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDIxLjAuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9InJlcGVhdCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeD0iMHB4IiB5PSIwcHgiCgkgdmlld0JveD0iMCAwIDI0IDI0IiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCAyNCAyNDsiIHhtbDpzcGFjZT0icHJlc2VydmUiPgo8c3R5bGUgdHlwZT0idGV4dC9jc3MiPgoJLnN0MHtmaWxsOiNDRjhCMTc7fQoJLnN0MXtmaWxsOiNGRkZGRkY7fQo8L3N0eWxlPgo8dGl0bGU+cmVwZWF0PC90aXRsZT4KPHBhdGggY2xhc3M9InN0MCIgZD0iTTIzLjMsMTFjLTAuMywwLjYtMC45LDEtMS41LDFoLTEuNmMtMC4xLDEuMy0wLjUsMi41LTEuMSwzLjZjLTAuOSwxLjctMi4zLDMuMi00LjEsNC4xCgljLTEuNywwLjktMy42LDEuMi01LjUsMC45Yy0xLjgtMC4zLTMuNS0xLjEtNC45LTIuM2MtMC43LTAuNy0wLjctMS45LDAtMi42YzAuNi0wLjYsMS42LTAuNywyLjMtMC4ySDdjMC45LDAuNiwxLjksMC45LDIuOSwwLjkKCXMxLjktMC4zLDIuNy0wLjljMS4xLTAuOCwxLjgtMi4xLDEuOC0zLjVoLTEuNWMtMC45LDAtMS43LTAuNy0xLjctMS43YzAtMC40LDAuMi0wLjksMC41LTEuMmw0LjQtNC40YzAuNy0wLjYsMS43LTAuNiwyLjQsMEwyMyw5LjIKCUMyMy41LDkuNywyMy42LDEwLjQsMjMuMywxMXoiLz4KPHBhdGggY2xhc3M9InN0MSIgZD0iTTIxLjgsMTFoLTIuNmMwLDEuNS0wLjMsMi45LTEsNC4yYy0wLjgsMS42LTIuMSwyLjgtMy43LDMuNmMtMS41LDAuOC0zLjMsMS4xLTQuOSwwLjhjLTEuNi0wLjItMy4yLTEtNC40LTIuMQoJYy0wLjQtMC4zLTAuNC0wLjktMC4xLTEuMmMwLjMtMC40LDAuOS0wLjQsMS4yLTAuMWwwLDBjMSwwLjcsMi4yLDEuMSwzLjQsMS4xczIuMy0wLjMsMy4zLTFjMC45LTAuNiwxLjYtMS41LDItMi42CgljMC4zLTAuOSwwLjQtMS44LDAuMi0yLjhoLTIuNGMtMC40LDAtMC43LTAuMy0wLjctMC43YzAtMC4yLDAuMS0wLjMsMC4yLTAuNGw0LjQtNC40YzAuMy0wLjMsMC43LTAuMywwLjksMEwyMiw5LjgKCWMwLjMsMC4zLDAuNCwwLjYsMC4zLDAuOVMyMiwxMSwyMS44LDExeiIvPgo8L3N2Zz4K"
  );
  blocksMedia.set(
    "green-flag.svg",
    "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwLDAsNjkuNDM1MTQsODEuODUzNjEiIGhlaWdodD0iODEuODUzNjEiIHdpZHRoPSI2OS40MzUxNCIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmVyc2lvbj0iMS4xIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImNvbG9yLTEiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiB5Mj0iMTkxLjg0MTM3IiB4Mj0iMjQwLjA3NDA0IiB5MT0iMTQxLjE1MDkyIiB4MT0iMjQwLjA3NDA0Ij48c3RvcCBzdG9wLWNvbG9yPSIjMDBhNWZmIiBvZmZzZXQ9IjAiPjwvc3RvcD48c3RvcCBzdG9wLWNvbG9yPSIjMDA2NWZmIiBvZmZzZXQ9IjEiPjwvc3RvcD48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtMjA0Ljc4MjQzLC0xMzkuNDk1NDcpIj48ZyBzdHlsZT0ibWl4LWJsZW5kLW1vZGU6IG5vcm1hbCIgc3Ryb2tlLWRhc2hvZmZzZXQ9IjAiIHN0cm9rZS1kYXNoYXJyYXk9IiIgc3Ryb2tlLW1pdGVybGltaXQ9IjEwIiBzdHJva2UtbGluZWpvaW49Im1pdGVyIiBzdHJva2U9IiMwMDMxNmIiIGZpbGwtcnVsZT0ibm9uemVybyIgZGF0YS1wYXBlci1kYXRhPSJ7JnF1b3Q7aXNQYWludGluZ0xheWVyJnF1b3Q7OnRydWV9Ij48cGF0aCBzdHJva2UtbGluZWNhcD0iYnV0dCIgc3Ryb2tlLXdpZHRoPSIzIiBmaWxsPSJ1cmwoI2NvbG9yLTEpIiBkPSJNMjA3LjQzMDUyLDE4Ny4yNjY0MnYtNDIuNDU1NTRjMCwwIDcuNDUwMDgsLTMuNjU5OTYgMTUuODExNzEsLTMuNjU5OTZjOC45ODk3MywwIDI1LjQ3NjM1LDguMjM0OTEgMzMuODMzNjYsOC4yMzQ5MWM4LjI5MjM0LDAgMTUuNjQxNjksLTQuNTc0OTUgMTUuNjQxNjksLTQuNTc0OTV2NDIuNDU1NTRjMCwwIC03LjM3NzI1LDQuNTc0OTUgLTE1LjY0MTY5LDQuNTc0OTVjLTcuNTEwNzcsMCAtMjQuNTc4NzMsLTguMjM0OTEgLTMyLjk4MzU3LC04LjIzNDkxYy04LjczMDY1LDAgLTE2LjY2MTgsMy42NTk5NiAtMTYuNjYxOCwzLjY1OTk2eiI+PC9wYXRoPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSI1IiBmaWxsPSJub25lIiBkPSJNMjA3LjI4MjQ0LDIxOC44NDkwOHYtNzYuODUzNjEiPjwvcGF0aD48L2c+PC9nPjwvc3ZnPjwhLS1yb3RhdGlvbkNlbnRlcjozNS4yMTc1NjUwMDAwMDAwMTo0MC41MDQ1Mjk5OTk5OTk5OS0tPg=="
  );
  blocksMedia.set(
    "blue-flag.svg",
    "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwLDAsNjkuNDM1MTQsODEuODUzNjEiIGhlaWdodD0iODEuODUzNjEiIHdpZHRoPSI2OS40MzUxNCIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmVyc2lvbj0iMS4xIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImNvbG9yLTEiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiB5Mj0iMTkxLjg0MTM3IiB4Mj0iMjQwLjA3NDA0IiB5MT0iMTQxLjE1MDkyIiB4MT0iMjQwLjA3NDA0Ij48c3RvcCBzdG9wLWNvbG9yPSIjMDBhNWZmIiBvZmZzZXQ9IjAiPjwvc3RvcD48c3RvcCBzdG9wLWNvbG9yPSIjMDA2NWZmIiBvZmZzZXQ9IjEiPjwvc3RvcD48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtMjA0Ljc4MjQzLC0xMzkuNDk1NDcpIj48ZyBzdHlsZT0ibWl4LWJsZW5kLW1vZGU6IG5vcm1hbCIgc3Ryb2tlLWRhc2hvZmZzZXQ9IjAiIHN0cm9rZS1kYXNoYXJyYXk9IiIgc3Ryb2tlLW1pdGVybGltaXQ9IjEwIiBzdHJva2UtbGluZWpvaW49Im1pdGVyIiBzdHJva2U9IiMwMDMxNmIiIGZpbGwtcnVsZT0ibm9uemVybyIgZGF0YS1wYXBlci1kYXRhPSJ7JnF1b3Q7aXNQYWludGluZ0xheWVyJnF1b3Q7OnRydWV9Ij48cGF0aCBzdHJva2UtbGluZWNhcD0iYnV0dCIgc3Ryb2tlLXdpZHRoPSIzIiBmaWxsPSJ1cmwoI2NvbG9yLTEpIiBkPSJNMjA3LjQzMDUyLDE4Ny4yNjY0MnYtNDIuNDU1NTRjMCwwIDcuNDUwMDgsLTMuNjU5OTYgMTUuODExNzEsLTMuNjU5OTZjOC45ODk3MywwIDI1LjQ3NjM1LDguMjM0OTEgMzMuODMzNjYsOC4yMzQ5MWM4LjI5MjM0LDAgMTUuNjQxNjksLTQuNTc0OTUgMTUuNjQxNjksLTQuNTc0OTV2NDIuNDU1NTRjMCwwIC03LjM3NzI1LDQuNTc0OTUgLTE1LjY0MTY5LDQuNTc0OTVjLTcuNTEwNzcsMCAtMjQuNTc4NzMsLTguMjM0OTEgLTMyLjk4MzU3LC04LjIzNDkxYy04LjczMDY1LDAgLTE2LjY2MTgsMy42NTk5NiAtMTYuNjYxOCwzLjY1OTk2eiI+PC9wYXRoPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSI1IiBmaWxsPSJub25lIiBkPSJNMjA3LjI4MjQ0LDIxOC44NDkwOHYtNzYuODUzNjEiPjwvcGF0aD48L2c+PC9nPjwvc3ZnPjwhLS1yb3RhdGlvbkNlbnRlcjozNS4yMTc1NjUwMDAwMDAwMTo0MC41MDQ1Mjk5OTk5OTk5OS0tPg=="
  );
  blocksMedia.set(
    "control_stop.svg",
    "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHdpZHRoPSI4MC40ODE0NSIgaGVpZ2h0PSI4MC40ODE0NSIgdmlld0JveD0iMCwwLDgwLjQ4MTQ1LDgwLjQ4MTQ1Ij48ZGVmcz48bGluZWFyR3JhZGllbnQgeDE9IjI0MC4wMDAwMSIgeTE9IjE0MS4yNTkyOCIgeDI9IjI0MC4wMDAwMSIgeTI9IjIxOC43NDA3MyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIGlkPSJjb2xvci0xIj48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNmZjI0ODQiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNjNDAwNTYiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtMTk5Ljc1OTI4LC0xMzkuNzU5MjgpIj48ZyBkYXRhLXBhcGVyLWRhdGE9InsmcXVvdDtpc1BhaW50aW5nTGF5ZXImcXVvdDs6dHJ1ZX0iIGZpbGw9InVybCgjY29sb3ItMSkiIGZpbGwtcnVsZT0ibm9uemVybyIgc3Ryb2tlPSIjNzgwMDM0IiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJidXR0IiBzdHJva2UtbGluZWpvaW49Im1pdGVyIiBzdHJva2UtbWl0ZXJsaW1pdD0iMTAiIHN0cm9rZS1kYXNoYXJyYXk9IiIgc3Ryb2tlLWRhc2hvZmZzZXQ9IjAiIHN0eWxlPSJtaXgtYmxlbmQtbW9kZTogbm9ybWFsIj48cGF0aCBkPSJNMjIzLjk1MzA3LDIxOC43NDA3M2wtMjIuNjkzNzksLTIyLjY5Mzc5di0zMi4wOTM4N2wyMi42OTM3OSwtMjIuNjkzNzloMzIuMDkzODdsMjIuNjkzNzksMjIuNjkzNzl2MzIuMDkzODdsLTIyLjY5Mzc5LDIyLjY5Mzc5eiIvPjwvZz48L2c+PC9zdmc+PCEtLXJvdGF0aW9uQ2VudGVyOjQwLjI0MDcxNzE0NTE0OTM1OjQwLjI0MDcxNzE0NTE0OTI5LS0+"
  );
  blocksMedia.set(
    "rotate-left.svg",
    "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48c3ZnIGlkPSJyb3RhdGUtY2xvY2t3aXNlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHN0eWxlPi5jbHMtMXtmaWxsOiMzZDc5Y2M7fS5jbHMtMntmaWxsOiNmZmY7fTwvc3R5bGU+PHRpdGxlPnJvdGF0ZS1jbG9ja3dpc2U8L3RpdGxlPjxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTIwLjM0LDE4LjIxYTEwLjI0LDEwLjI0LDAsMCwxLTguMSw0LjIyLDIuMjYsMi4yNiwwLDAsMS0uMTYtNC41MmgwYTUuNTgsNS41OCwwLDAsMCw0LjI1LTIuNTMsNS4wNiw1LjA2LDAsMCwwLC41NC00LjYyQTQuMjUsNC4yNSwwLDAsMCwxNS41NSw5YTQuMzEsNC4zMSwwLDAsMC0yLS44QTQuODIsNC44MiwwLDAsMCwxMC40LDlsMS4xMiwxLjQxQTEuNTksMS41OSwwLDAsMSwxMC4zNiwxM0gyLjY3YTEuNTYsMS41NiwwLDAsMS0xLjI2LS42M0ExLjU0LDEuNTQsMCwwLDEsMS4xMywxMUwyLjg1LDMuNTdBMS41OSwxLjU5LDAsMCwxLDQuMzgsMi40LDEuNTcsMS41NywwLDAsMSw1LjYyLDNMNi43LDQuMzVhMTAuNjYsMTAuNjYsMCwwLDEsNy43Mi0xLjY4QTkuODgsOS44OCwwLDAsMSwxOSw0LjgxLDkuNjEsOS42MSwwLDAsMSwyMS44Myw5LDEwLjA4LDEwLjA4LDAsMCwxLDIwLjM0LDE4LjIxWiIvPjxwYXRoIGNsYXNzPSJjbHMtMiIgZD0iTTE5LjU2LDE3LjY1YTkuMjksOS4yOSwwLDAsMS03LjM1LDMuODMsMS4zMSwxLjMxLDAsMCwxLS4wOC0yLjYyLDYuNTMsNi41MywwLDAsMCw1LTIuOTIsNi4wNSw2LjA1LDAsMCwwLC42Ny01LjUxLDUuMzIsNS4zMiwwLDAsMC0xLjY0LTIuMTYsNS4yMSw1LjIxLDAsMCwwLTIuNDgtMUE1Ljg2LDUuODYsMCwwLDAsOSw4Ljg0TDEwLjc0LDExYS41OS41OSwwLDAsMS0uNDMsMUgyLjdhLjYuNiwwLDAsMS0uNi0uNzVMMy44MSwzLjgzYS41OS41OSwwLDAsMSwxLS4yMWwxLjY3LDIuMWE5LjcxLDkuNzEsMCwwLDEsNy43NS0yLjA3LDguODQsOC44NCwwLDAsMSw0LjEyLDEuOTIsOC42OCw4LjY4LDAsMCwxLDIuNTQsMy43MkE5LjE0LDkuMTQsMCwwLDEsMTkuNTYsMTcuNjVaIi8+PC9zdmc+"
  );
  blocksMedia.set(
    "rotate-right.svg",
    "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48c3ZnIGlkPSJyb3RhdGUtY291bnRlci1jbG9ja3dpc2UiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmlld0JveD0iMCAwIDI0IDI0Ij48ZGVmcz48c3R5bGU+LmNscy0xe2ZpbGw6IzNkNzljYzt9LmNscy0ye2ZpbGw6I2ZmZjt9PC9zdHlsZT48L2RlZnM+PHRpdGxlPnJvdGF0ZS1jb3VudGVyLWNsb2Nrd2lzZTwvdGl0bGU+PHBhdGggY2xhc3M9ImNscy0xIiBkPSJNMjIuNjgsMTIuMmExLjYsMS42LDAsMCwxLTEuMjcuNjNIMTMuNzJhMS41OSwxLjU5LDAsMCwxLTEuMTYtMi41OGwxLjEyLTEuNDFhNC44Miw0LjgyLDAsMCwwLTMuMTQtLjc3LDQuMzEsNC4zMSwwLDAsMC0yLC44LDQuMjUsNC4yNSwwLDAsMC0xLjM0LDEuNzMsNS4wNiw1LjA2LDAsMCwwLC41NCw0LjYyQTUuNTgsNS41OCwwLDAsMCwxMiwxNy43NGgwYTIuMjYsMi4yNiwwLDAsMS0uMTYsNC41MkExMC4yNSwxMC4yNSwwLDAsMSwzLjc0LDE4LDEwLjE0LDEwLjE0LDAsMCwxLDIuMjUsOC43OCw5LjcsOS43LDAsMCwxLDUuMDgsNC42NCw5LjkyLDkuOTIsMCwwLDEsOS42NiwyLjVhMTAuNjYsMTAuNjYsMCwwLDEsNy43MiwxLjY4bDEuMDgtMS4zNWExLjU3LDEuNTcsMCwwLDEsMS4yNC0uNiwxLjYsMS42LDAsMCwxLDEuNTQsMS4yMWwxLjcsNy4zN0ExLjU3LDEuNTcsMCwwLDEsMjIuNjgsMTIuMloiLz48cGF0aCBjbGFzcz0iY2xzLTIiIGQ9Ik0yMS4zOCwxMS44M0gxMy43N2EuNTkuNTksMCwwLDEtLjQzLTFsMS43NS0yLjE5YTUuOSw1LjksMCwwLDAtNC43LTEuNTgsNS4wNyw1LjA3LDAsMCwwLTQuMTEsMy4xN0E2LDYsMCwwLDAsNywxNS43N2E2LjUxLDYuNTEsMCwwLDAsNSwyLjkyLDEuMzEsMS4zMSwwLDAsMS0uMDgsMi42Miw5LjMsOS4zLDAsMCwxLTcuMzUtMy44MkE5LjE2LDkuMTYsMCwwLDEsMy4xNyw5LjEyLDguNTEsOC41MSwwLDAsMSw1LjcxLDUuNCw4Ljc2LDguNzYsMCwwLDEsOS44MiwzLjQ4YTkuNzEsOS43MSwwLDAsMSw3Ljc1LDIuMDdsMS42Ny0yLjFhLjU5LjU5LDAsMCwxLDEsLjIxTDIyLDExLjA4QS41OS41OSwwLDAsMSwyMS4zOCwxMS44M1oiLz48L3N2Zz4="
  );
  blocksMedia.set(
    "dropdown-arrow.svg",
    "data:image/svg+xml;base64,PHN2ZyBpZD0iTGF5ZXJfMSIgZGF0YS1uYW1lPSJMYXllciAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMi43MSIgaGVpZ2h0PSI4Ljc5IiB2aWV3Qm94PSIwIDAgMTIuNzEgOC43OSI+PHRpdGxlPmRyb3Bkb3duLWFycm93PC90aXRsZT48ZyBvcGFjaXR5PSIwLjEiPjxwYXRoIGQ9Ik0xMi43MSwyLjQ0QTIuNDEsMi40MSwwLDAsMSwxMiw0LjE2TDguMDgsOC4wOGEyLjQ1LDIuNDUsMCwwLDEtMy40NSwwTDAuNzIsNC4xNkEyLjQyLDIuNDIsMCwwLDEsMCwyLjQ0LDIuNDgsMi40OCwwLDAsMSwuNzEuNzFDMSwwLjQ3LDEuNDMsMCw2LjM2LDBTMTEuNzUsMC40NiwxMiwuNzFBMi40NCwyLjQ0LDAsMCwxLDEyLjcxLDIuNDRaIiBmaWxsPSIjMjMxZjIwIi8+PC9nPjxwYXRoIGQ9Ik02LjM2LDcuNzlhMS40MywxLjQzLDAsMCwxLTEtLjQyTDEuNDIsMy40NWExLjQ0LDEuNDQsMCwwLDEsMC0yYzAuNTYtLjU2LDkuMzEtMC41Niw5Ljg3LDBhMS40NCwxLjQ0LDAsMCwxLDAsMkw3LjM3LDcuMzdBMS40MywxLjQzLDAsMCwxLDYuMzYsNy43OVoiIGZpbGw9IiNmZmYiLz48L3N2Zz4="
  );

  addon.tab.createBlockContextMenu(
    (items) => {
      if (addon.self.disabled) return items;
      let svgchild = document.querySelector("svg.blocklySvg g.blocklyBlockCanvas");

      const pasteItemIndex = items.findIndex((obj) => obj._isDevtoolsFirstItem);
      const insertBeforeIndex =
        pasteItemIndex !== -1
          ? // If "paste" button exists, add own items before it
            pasteItemIndex
          : // If there's no such button, insert at end
            items.length;

      items.splice(
        insertBeforeIndex,
        0,
        {
          enabled: !!svgchild?.childNodes?.length,
          text: msg("export_all_to_SVG"),
          callback: () => {
            exportBlock(false);
          },
          separator: true,
        },
        {
          enabled: !!svgchild?.childNodes?.length,
          text: msg("export_all_to_PNG"),
          callback: () => {
            exportBlock(true);
          },
          separator: false,
        }
      );

      return items;
    },
    { workspace: true }
  );
  addon.tab.createBlockContextMenu(
    (items, block) => {
      if (addon.self.disabled) return items;
      const makeSpaceItemIndex = items.findIndex((obj) => obj._isDevtoolsFirstItem);
      const insertBeforeIndex =
        makeSpaceItemIndex !== -1
          ? // If "make space" button exists, add own items before it
            makeSpaceItemIndex
          : // If there's no such button, insert at end
            items.length;

      items.splice(
        insertBeforeIndex,
        0,
        {
          enabled: true,
          text: msg("export_selected_to_SVG"),
          callback: () => {
            exportBlock(false, block);
          },
          separator: true,
        },
        {
          enabled: true,
          text: msg("export_selected_to_PNG"),
          callback: () => {
            exportBlock(true, block);
          },
          separator: false,
        }
      );

      return items;
    },
    { blocks: true }
  );

  function exportBlock(isExportPNG, block) {
    let svg;
    if (block) {
      svg = selectedBlocks(isExportPNG, block);
    } else {
      svg = allBlocks(isExportPNG);
    }
    prepareSvg(svg);
    if (!isExportPNG) {
      exportData(new XMLSerializer().serializeToString(svg));
    } else {
      exportPNG(svg);
    }
  }

  // troca &nbsp; e resolve os caminhos das imagens internas (usado pelas exportações e pela imagem das mudanças)
  function prepareSvg(svg) {
    // resolve nbsp whitespace
    svg.querySelectorAll("text").forEach((text) => {
      text.innerHTML = text.innerHTML.replace(/&nbsp;/g, " ");
    });
    // resolve image path
    let scratchURL = window.location.origin;

    svg.querySelectorAll("image").forEach((item) => {
      let builtinSvgData = blocksMedia.get(
        item.getAttribute("xlink:href").substring(item.getAttribute("xlink:href").lastIndexOf("/") + 1)
      );
      if (builtinSvgData) {
        // replace svg file path (official) to inline svg
        item.setAttribute("xlink:href", builtinSvgData);
      } else if (item.getAttribute("xlink:href").indexOf("/static/") === 0) {
        // replace link path for third party website
        item.setAttribute("xlink:href", scratchURL + item.getAttribute("xlink:href").slice(0));
      } else if (item.getAttribute("xlink:href").indexOf("./static/") === 0) {
        item.setAttribute("xlink:href", scratchURL + item.getAttribute("xlink:href").slice(1));
      } else if (item.getAttribute("xlink:href").indexOf("static/") === 0) {
        item.setAttribute("xlink:href", scratchURL + "/" + item.getAttribute("xlink:href"));
      }
    });
  }

  function selectedBlocks(isExportPNG, block) {
    let svg = exSVG.cloneNode();

    let svgchild = block.svgGroup_;
    svgchild = svgchild.cloneNode(true);
    let dataShapes = svgchild.getAttribute("data-shapes");
    svgchild.setAttribute(
      "transform",
      `translate(0,${dataShapes === "hat" ? "18" : "0"}) ${isExportPNG ? "scale(2)" : ""}`
    );
    setCSSVars(svg);
    svg.append(makeStyle());
    svg.append(svgchild);
    return svg;
  }

  function allBlocks(isExportPNG) {
    let svg = exSVG.cloneNode();

    let svgchild = document.querySelector("svg.blocklySvg g.blocklyBlockCanvas");
    svgchild = svgchild.cloneNode(true);

    let xArr = [];
    let yArr = [];

    svgchild.childNodes.forEach((g) => {
      let x = g.getAttribute("transform").match(/translate\((.*?),(.*?)\)/)[1] || 0;
      let y = g.getAttribute("transform").match(/translate\((.*?),(.*?)\)/)[2] || 0;
      xArr.push(x * (isExportPNG ? 2 : 1));
      yArr.push(y * (isExportPNG ? 2 : 1));
      g.style.display = ""; // because of TW scratch-blocks changes
    });

    svgchild.setAttribute(
      "transform",
      `translate(${-Math.min(...xArr)},${-Math.min(...yArr) + 18 * (isExportPNG ? 2 : 1)}) ${
        isExportPNG ? "scale(2)" : ""
      }`
    );
    setCSSVars(svg);
    svg.append(makeStyle());
    svg.append(svgchild);
    return svg;
  }

  function exportData(text) {
    const saveLink = document.createElement("a");
    document.body.appendChild(saveLink);

    const data = new Blob([text], { type: "text" });
    const url = window.URL.createObjectURL(data);
    saveLink.href = url;

    // File name: project-DATE-TIME
    const date = new Date();
    const timestamp = `${date.toLocaleDateString()}-${date.toLocaleTimeString()}`;
    saveLink.download = `block_${timestamp}.svg`;
    saveLink.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(saveLink);
  }

  function exportPNG(svg) {
    const serializer = new XMLSerializer();

    const iframe = document.createElement("iframe");
    // iframe.style.display = "none"
    document.body.append(iframe);
    iframe.contentDocument.write(serializer.serializeToString(svg));
    let { width, height } = iframe.contentDocument.body.querySelector("svg g").getBoundingClientRect();
    height = height + 20 * 2; //  hat block height restore
    svg.setAttribute("width", width + "px");
    svg.setAttribute("height", height + "px");

    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d");

    let img = document.createElement("img");

    img.setAttribute(
      "src",
      "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(serializer.serializeToString(svg))))
    );
    img.onload = function () {
      canvas.height = img.height;
      canvas.width = img.width;
      ctx.drawImage(img, 0, 0, img.width, img.height);
      // Now is done
      let dataURL = canvas.toDataURL("image/png");
      let link = document.createElement("a");
      const date = new Date();
      const timestamp = `${date.toLocaleDateString()}-${date.toLocaleTimeString()}`;

      link.download = `block_${timestamp}.png`;
      link.href = dataURL;
      link.click();
      iframe.remove();
    };
  }

  // ====================================================================
  // Git: destaque dos blocos com mudanças não salvas + imagem das mudanças
  //
  // A aba Git do editor publica o projeto do último commit em window.__gitBlocksBridge.baseline
  // (e avisa com o evento "git-tab:baseline"). Aqui comparamos o projeto aberto com ele, bloco a bloco.
  // Sem baseline (aba Git ainda não aberta / sem commit), nada disso aparece.
  // ====================================================================
  const BRIDGE_KEY = "__gitBlocksBridge";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const FONT = "Helvetica Neue, Helvetica, sans-serif";
  const vm = addon.tab.traps.vm;

  const getSetting = (id, fallback) => {
    try {
      const value = addon.settings.get(id);
      return value === undefined || value === null ? fallback : value;
    } catch (e) {
      return fallback;
    }
  };
  const getColors = () => ({
    added: getSetting("addedColor", "#0fbd8c"),
    modified: getSetting("modifiedColor", "#ffab19"),
    removed: getSetting("removedColor", "#ff4c4c"),
  });
  const bridge = () => (window[BRIDGE_KEY] = window[BRIDGE_KEY] || {});

  // O workspace do Blockly nem sempre vem de addon.tab.traps.getWorkspace() (ele depende dos nomes de classe do
  // editor). Por isso tenta várias formas, da mais simples para a mais "braçal".
  let blocklyRef = null;
  try {
    Promise.resolve(addon.tab.traps.getBlockly())
      .then((b) => (blocklyRef = b))
      .catch(() => {});
  } catch (e) {
    // sem getBlockly: usa as outras formas
  }
  const looksLikeWorkspace = (ws) =>
    !!ws && typeof ws.getAllBlocks === "function" && typeof ws.getTopBlocks === "function";

  // procura o componente React que guarda o workspace, subindo a partir do <svg class="blocklySvg">
  function workspaceFromReact() {
    for (let node = document.querySelector("svg.blocklySvg"); node; node = node.parentElement) {
      const key = Object.keys(node).find((k) => k.startsWith("__reactInternalInstance$") || k.startsWith("__reactFiber$"));
      if (!key) continue;
      for (let fiber = node[key]; fiber; fiber = fiber.return) {
        const ws = fiber.stateNode && fiber.stateNode.workspace;
        if (looksLikeWorkspace(ws)) return ws;
      }
    }
    return null;
  }

  let warnedNoWorkspace = false;
  const getWorkspace = () => {
    const strategies = [
      ["addon.tab.traps.getWorkspace", () => addon.tab.traps.getWorkspace()],
      ["getBlockly().getMainWorkspace", () => blocklyRef && blocklyRef.getMainWorkspace()],
      ["window.Blockly.getMainWorkspace", () => window.Blockly && window.Blockly.getMainWorkspace()],
      ["window.ScratchBlocks.getMainWorkspace", () => window.ScratchBlocks && window.ScratchBlocks.getMainWorkspace()],
      ["React", workspaceFromReact],
    ];
    for (const [, get] of strategies) {
      try {
        const ws = get();
        if (looksLikeWorkspace(ws)) return ws;
      } catch (e) {
        // tenta a próxima
      }
    }
    // só reclama se a área de código existe na tela e mesmo assim não achamos o workspace
    if (!warnedNoWorkspace && document.querySelector("svg.blocklySvg")) {
      warnedNoWorkspace = true;
      console.warn("[Git] A área de código existe, mas não achei o workspace do Blockly.", {
        traps: Object.keys(addon.tab.traps || {}),
        blockly: !!blocklyRef,
        windowBlockly: !!window.Blockly,
        windowScratchBlocks: !!window.ScratchBlocks,
      });
    }
    return null;
  };

  let baseline = bridge().baseline || null; // { json, label, sha }
  let diff = null; // resultado de diffProjects
  let showHighlight = getSetting("highlight", true);
  let navIndex = -1;
  let recomputeTimer = null;
  let toastTimer = null;
  let lastWorkspace = null;
  let lastTargetId = null;
  const ui = { expanded: false, toast: "" };

  // ---------- helpers de DOM (sem innerHTML: rótulos vêm do projeto/commit, não são confiáveis) ----------
  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === "class") node.className = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) node.setAttribute(k, "");
      else if (v !== false && v !== null && v !== undefined) node.setAttribute(k, v);
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
    return node;
  }
  function svgEl(tag, attrs, ...children) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
    for (const child of children) node.append(child.nodeType ? child : document.createTextNode(String(child)));
    return node;
  }
  function readableOn(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return "#fff";
    const n = parseInt(m[1], 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#1d1d1f" : "#fff";
  }

  // ---------- estilos (painel, janela e destaque dos blocos) ----------
  const styleEl = el("style", { id: "sa-git-style" });
  function updateStyle() {
    const c = getColors();
    styleEl.textContent = `
    .sa-git-added > .blocklyPath { stroke: ${c.added} !important; stroke-width: 3px !important; }
    .sa-git-modified > .blocklyPath { stroke: ${c.modified} !important; stroke-width: 3px !important; stroke-dasharray: 7 4; }

    .sa-git-panel { position: absolute; top: 8px; right: 12px; z-index: 30; display: flex; flex-direction: column;
      align-items: flex-end; gap: 6px; width: min(360px, 72%); font: 600 12px/1.35 ${FONT}; color: var(--text-primary, #575e75); }
    .sa-git-panel[hidden] { display: none !important; }
    .sa-git-pill, .sa-git-btn, .sa-git-target, .sa-git-item { font: inherit; color: inherit; cursor: pointer; }
    .sa-git-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px;
      background: var(--ui-secondary, #fff); border: 2px solid var(--ui-black-transparent, rgba(0,0,0,.18)); }
    .sa-git-chip { padding: 1px 7px; border-radius: 999px; font-size: 11px; }
    .sa-git-card { box-sizing: border-box; width: 100%; max-height: 62vh; overflow: auto; display: flex; flex-direction: column;
      gap: 8px; padding: 10px; border-radius: 8px; background: var(--ui-secondary, #fff);
      border: 2px solid var(--ui-black-transparent, rgba(0,0,0,.18)); box-shadow: 0 4px 14px rgba(0,0,0,.18); }
    .sa-git-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .sa-git-btn { padding: 4px 10px; border-radius: 999px; background: transparent; border: 2px solid var(--ui-black-transparent, rgba(0,0,0,.22)); }
    .sa-git-btn:hover:not(:disabled) { background: var(--ui-tertiary, #c7d3e6); }
    .sa-git-btn[aria-pressed="true"] { background: var(--motion-primary, #4c97ff); border-color: var(--motion-tertiary, #3373cc); color: #fff; }
    .sa-git-btn:disabled { opacity: .5; cursor: not-allowed; }
    .sa-git-btn:focus-visible, .sa-git-pill:focus-visible, .sa-git-target:focus-visible, .sa-git-item:focus-visible,
    .sa-git-input:focus-visible { outline: 2px solid var(--motion-primary, #4c97ff); outline-offset: 2px; }
    .sa-git-muted { font-weight: 500; font-size: 11px; opacity: .8; overflow-wrap: anywhere; }
    .sa-git-title { font-size: 12px; font-weight: 700; }
    .sa-git-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 3px; }
    .sa-git-target, .sa-git-item { width: 100%; box-sizing: border-box; text-align: left; padding: 4px 8px; border-radius: 6px;
      background: var(--ui-primary, #e5f0ff); border: 2px solid transparent; }
    .sa-git-target:hover, .sa-git-item:hover { border-color: var(--motion-primary, #4c97ff); }
    .sa-git-target[aria-current="true"] { border-color: var(--motion-primary, #4c97ff); }
    .sa-git-item { display: flex; gap: 6px; align-items: baseline; }
    .sa-git-mark { flex: none; width: 1.2em; font-weight: 700; text-align: center; }
    .sa-git-removed { text-decoration: line-through; opacity: .8; cursor: default; }
    .sa-git-lines { font-weight: 500; font-size: 11px; opacity: .85; overflow-wrap: anywhere; }
    .sa-git-toast { align-self: flex-end; padding: 4px 10px; border-radius: 8px; background: var(--ui-tertiary, #c7d3e6); }
    .sa-git-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

    .sa-git-overlay { position: fixed; inset: 0; z-index: 100000; display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,.5); font: 600 13px/1.4 ${FONT}; }
    .sa-git-dialog { box-sizing: border-box; display: flex; flex-direction: column; gap: 10px; width: min(960px, 94vw);
      max-height: 90vh; padding: 16px; border-radius: 12px; color: var(--text-primary, #575e75);
      background: var(--ui-secondary, #fff); box-shadow: 0 10px 40px rgba(0,0,0,.35); }
    .sa-git-dialog-title { margin: 0; font-size: 16px; font-weight: 700; }
    .sa-git-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
    .sa-git-check { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
    .sa-git-input { padding: 4px 8px; font: inherit; color: inherit; border-radius: 6px; background: var(--ui-primary, #e5f0ff);
      border: 2px solid var(--ui-black-transparent, rgba(0,0,0,.2)); }
    .sa-git-preview { min-height: 140px; overflow: auto; padding: 12px; border-radius: 8px; background: #fff;
      border: 2px solid var(--ui-black-transparent, rgba(0,0,0,.18)); }
    .sa-git-preview img { display: block; max-width: none; }
    .sa-git-footer { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
    @media (prefers-reduced-motion: no-preference) { .sa-git-btn, .sa-git-target, .sa-git-item { transition: background-color .12s ease; } }
    `;
  }
  updateStyle();
  document.head.append(styleEl);

  // ---------- diff do projeto aberto contra o commit ----------
  const publishSummary = () => {
    const summary = diff ? { ...diff.totals, label: baseline.label } : null;
    bridge().summary = summary;
    window.dispatchEvent(new CustomEvent("git-tab:diff-summary", { detail: summary }));
  };

  function recompute() {
    clearTimeout(recomputeTimer);
    if (addon.self.disabled || !baseline || !baseline.json) {
      diff = null;
    } else {
      try {
        const raw = vm.toJSON();
        diff = diffProjects(baseline.json, typeof raw === "string" ? JSON.parse(raw) : raw);
      } catch (e) {
        console.warn("Não foi possível comparar o projeto com o commit:", e);
        diff = null;
      }
    }
    publishSummary();
    renderPanel();
    applyHighlights();
  }
  const scheduleRecompute = (delay = 900) => {
    clearTimeout(recomputeTimer);
    recomputeTimer = setTimeout(recompute, delay);
  };

  const isCurrentEntry = (entry) => {
    const t = vm.editingTarget;
    return !!t && (entry.isStage ? !!t.isStage : !t.isStage && !!t.sprite && t.sprite.name === entry.name);
  };
  const currentTargetDiff = () => (diff ? diff.targets.find((e) => !e.removedTarget && isCurrentEntry(e)) || null : null);
  const targetFor = (entry) =>
    vm.runtime.targets.find(
      (t) => t.isOriginal && (entry.isStage ? t.isStage : !t.isStage && t.sprite && t.sprite.name === entry.name)
    );

  // ---------- destaque dos blocos no editor ----------
  function applyHighlights(force = false) {
    const ws = getWorkspace();
    if (!ws) return;
    const td = currentTargetDiff();
    const added = new Set(td ? td.added : []);
    const modified = new Set(td ? td.modified.map((m) => m.id) : []);
    const on = !!td && (force || (showHighlight && !addon.self.disabled));
    for (const block of ws.getAllBlocks()) {
      const g = block.svgGroup_;
      if (!g) continue;
      const isAdded = on && added.has(block.id);
      const isModified = on && !isAdded && modified.has(block.id);
      g.classList.toggle("sa-git-added", isAdded);
      g.classList.toggle("sa-git-modified", isModified);
    }
  }

  function changedBlocksInOrder() {
    const ws = getWorkspace();
    const td = currentTargetDiff();
    if (!ws || !td) return [];
    const hit = new Set([...td.added, ...td.modified.map((m) => m.id)]);
    return ws
      .getAllBlocks()
      .filter((b) => hit.has(b.id) && !b.isShadow())
      .map((b) => ({ b, xy: b.getRelativeToSurfaceXY() }))
      .sort((p, q) => p.xy.y - q.xy.y || p.xy.x - q.xy.x)
      .map((p) => p.b);
  }
  function focusBlock(block) {
    const ws = getWorkspace();
    try {
      if (ws && ws.centerOnBlock) ws.centerOnBlock(block.id);
    } catch (e) {
      console.warn(e);
    }
    try {
      block.select();
    } catch (e) {
      console.warn(e);
    }
  }
  function go(delta) {
    const blocks = changedBlocksInOrder();
    if (!blocks.length) return setToast("Nenhuma mudança neste sprite.");
    navIndex = navIndex < 0 ? (delta > 0 ? 0 : blocks.length - 1) : (navIndex + delta + blocks.length) % blocks.length;
    focusBlock(blocks[navIndex]);
    setToast(`Mudança ${navIndex + 1} de ${blocks.length}`);
  }

  function switchTarget(id) {
    return new Promise((resolve) => {
      if (vm.editingTarget && vm.editingTarget.id === id) return resolve();
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        vm.removeListener("workspaceUpdate", finish);
        // espera o editor desenhar os blocos do sprite novo
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 60)));
      };
      vm.on("workspaceUpdate", finish);
      vm.setEditingTarget(id);
      setTimeout(finish, 2500);
    });
  }

  // ---------- painel flutuante ----------
  const panelContent = el("div", { class: "sa-git-content" });
  const live = el("div", { class: "sa-git-sr", role: "status", "aria-live": "polite" });
  const panel = el("div", { class: "sa-git-panel", hidden: true }, panelContent, live);
  panelContent.style.cssText = "display:contents";

  function setToast(text) {
    ui.toast = text;
    live.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      ui.toast = "";
      renderPanel();
    }, 4000);
    renderPanel();
  }

  function toggleHighlight() {
    showHighlight = !showHighlight;
    applyHighlights();
    renderPanel();
  }

  function suggestMessage() {
    if (!diff) return;
    const text = summaryText(diff);
    bridge().pendingMessage = text;
    window.dispatchEvent(new CustomEvent("git-tab:suggest-message", { detail: { text } }));
    setToast("Mensagem pronta: abra a aba Git para commitar.");
  }

  function chip(kind, n, label) {
    const c = getColors();
    const sign = kind === "added" ? "+" : kind === "modified" ? "~" : "−";
    return el(
      "span",
      { class: "sa-git-chip", title: `${n} ${label}`, style: `background:${c[kind]};color:${readableOn(c[kind])}` },
      `${sign}${n}`
    );
  }
  const button = (text, onClick, label, extra) =>
    el("button", Object.assign({ class: "sa-git-btn", type: "button", onClick, "aria-label": label }, extra), text);

  function blockLabel(ws, id) {
    const b = ws && ws.getBlockById(id);
    if (!b) return "(bloco)";
    try {
      const text = b.toString(60);
      if (text) return text;
    } catch (e) {
      // usa o tipo
    }
    return b.type;
  }

  function changeItem(kind, id, label, lines) {
    const mark = { added: "+", modified: "~", removed: "−" }[kind];
    const c = getColors()[kind];
    const ws = getWorkspace();
    const body = [
      el("span", { class: "sa-git-mark", style: `color:${c}`, "aria-hidden": "true" }, mark),
      el(
        "span",
        {},
        el("span", { class: kind === "removed" ? "sa-git-removed" : "" }, label),
        ...lines.map((l) => el("div", { class: "sa-git-lines" }, l))
      ),
    ];
    const srKind = { added: "adicionado", modified: "modificado", removed: "removido" }[kind];
    if (kind === "removed") {
      return el("li", { "data-id": id }, el("div", { class: "sa-git-item sa-git-removed", title: "Bloco removido" }, body));
    }
    return el(
      "li",
      { "data-id": id },
      el(
        "button",
        {
          class: "sa-git-item",
          type: "button",
          "aria-label": `${srKind}: ${label}. Ir até o bloco`,
          onClick: () => {
            const b = ws && ws.getBlockById(id);
            if (b) focusBlock(b);
          },
        },
        body
      )
    );
  }

  function renderCard() {
    const card = el("div", { class: "sa-git-card" });
    card.append(el("div", { class: "sa-git-muted" }, `Comparando com ${baseline.label}`));
    card.append(
      el(
        "div",
        { class: "sa-git-row" },
        button("◀", () => go(-1), "Mudança anterior"),
        button("▶", () => go(1), "Próxima mudança"),
        button(showHighlight ? "Destaque: ligado" : "Destaque: desligado", toggleHighlight, undefined, {
          "aria-pressed": String(showHighlight),
        }),
        button("Imagem…", openModal),
        button("Mensagem de commit", suggestMessage)
      )
    );

    const withChanges = diff.targets.filter((e) => e.added.length || e.modified.length || e.removed.length);
    if (withChanges.length) {
      const list = el("ul", { class: "sa-git-list" });
      for (const e of withChanges) {
        const counts = [e.added.length && `+${e.added.length}`, e.modified.length && `~${e.modified.length}`, e.removed.length && `−${e.removed.length}`]
          .filter(Boolean)
          .join(" ");
        const name = (e.isStage ? "Palco" : e.name) + (e.removedTarget ? " (removido)" : e.newTarget ? " (novo)" : "");
        list.append(
          el(
            "li",
            {},
            el(
              "button",
              {
                class: "sa-git-target",
                type: "button",
                disabled: !!e.removedTarget,
                "aria-current": String(isCurrentEntry(e)),
                onClick: async () => {
                  const t = targetFor(e);
                  if (t) await switchTarget(t.id);
                },
              },
              `${name}  ${counts}`
            )
          )
        );
      }
      card.append(el("div", { class: "sa-git-title" }, "Sprites com mudanças"), list);
    } else {
      card.append(el("div", { class: "sa-git-muted" }, "Nenhuma mudança nos blocos desde o commit."));
    }

    const td = currentTargetDiff();
    if (td && (td.added.length || td.modified.length || td.removed.length)) {
      const ws = getWorkspace();
      const items = el("ul", { class: "sa-git-list" });
      const MAX = 150;
      let count = 0;
      const total = td.added.length + td.modified.length + td.removed.length;
      for (const id of td.added) if (count++ < MAX) items.append(changeItem("added", id, blockLabel(ws, id), []));
      for (const m of td.modified) if (count++ < MAX) items.append(changeItem("modified", m.id, blockLabel(ws, m.id), m.lines));
      for (const r of td.removed) if (count++ < MAX) items.append(changeItem("removed", r.id, r.label, []));
      if (total > MAX) items.append(el("li", { class: "sa-git-muted" }, `… e mais ${total - MAX}`));
      card.append(el("div", { class: "sa-git-title" }, `Neste sprite (${td.isStage ? "Palco" : td.name})`), items);
    }
    return card;
  }

  function renderPanel() {
    panelContent.textContent = "";
    const visible = !addon.self.disabled && getSetting("showPanel", true) && !!baseline && !!diff;
    panel.hidden = !visible;
    if (!visible) return;
    const t = diff.totals;
    panelContent.append(
      el(
        "button",
        {
          class: "sa-git-pill",
          type: "button",
          "aria-expanded": String(ui.expanded),
          title: "Mudanças desde o último commit",
          onClick: () => {
            ui.expanded = !ui.expanded;
            renderPanel();
          },
        },
        "Git",
        chip("added", t.added, "blocos adicionados"),
        chip("modified", t.modified, "blocos modificados"),
        chip("removed", t.removed, "blocos removidos")
      )
    );
    if (ui.toast) panelContent.append(el("div", { class: "sa-git-toast", "aria-hidden": "true" }, ui.toast));
    if (ui.expanded) panelContent.append(renderCard());
  }

  function ensureMounted() {
    if (addon.self.disabled) return;
    const ws = getWorkspace();
    let host = null;
    if (ws) {
      host = ws.getInjectionDiv ? ws.getInjectionDiv() : null;
      if (!host && ws.getParentSvg) host = ws.getParentSvg().parentNode; // div.injectionDiv
    }
    if (host && panel.parentNode !== host) {
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
      host.append(panel);
    }
    const target = vm.editingTarget ? vm.editingTarget.id : null;
    if (ws && diff && (ws !== lastWorkspace || target !== lastTargetId)) {
      lastWorkspace = ws;
      lastTargetId = target;
      applyHighlights();
      renderPanel();
    }
  }

  // ---------- imagem das mudanças (SVG/PNG) ----------
  function collectSection(ws, entry, onlyAdded) {
    const hit = new Set([...entry.added, ...(onlyAdded ? [] : entry.modified.map((m) => m.id))]);
    const scripts = [];
    for (const top of ws.getTopBlocks(true)) {
      if (!top.getDescendants(false).some((b) => hit.has(b.id))) continue;
      const g = top.svgGroup_;
      const previousDisplay = g.style.display;
      g.style.display = ""; // TurboWarp esconde blocos fora da tela
      let bbox = g.getBBox();
      g.style.display = previousDisplay;
      if (!bbox.width || !bbox.height) {
        const size = top.getHeightWidth();
        bbox = { x: 0, y: 0, width: size.width, height: size.height };
      }
      const clone = g.cloneNode(true);
      clone.style.display = "";
      for (const node of [clone, ...clone.querySelectorAll(".blocklySelected, .sa-git-modified")]) {
        node.classList.remove("blocklySelected");
        if (onlyAdded) node.classList.remove("sa-git-modified");
      }
      scripts.push({ clone, bbox: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height } });
    }
    const a = entry.added.length;
    const m = entry.modified.length;
    const parts = [`${a} adicionado${a === 1 ? "" : "s"}`];
    if (!onlyAdded && m) parts.push(`${m} modificado${m === 1 ? "" : "s"}`);
    return { title: `${entry.isStage ? "Palco" : entry.name} — ${parts.join(", ")}`, scripts };
  }

  function assembleSvg(sections, opts) {
    const PAD = 16;
    const GAP = 20;
    const colors = getColors();
    const root = exSVG.cloneNode();
    setCSSVars(root);
    root.append(makeStyle());
    const highlightStyle = document.createElement("style");
    highlightStyle.textContent =
      `.sa-git-added > .blocklyPath{stroke:${colors.added} !important;stroke-width:3px !important}` +
      `.sa-git-modified > .blocklyPath{stroke:${colors.modified} !important;stroke-width:3px !important;stroke-dasharray:7 4}`;
    root.append(highlightStyle);

    const body = svgEl("g");
    let y = PAD;
    let maxWidth = 320;
    body.append(
      svgEl("text", { x: PAD, y: y + 14, "font-size": 14, "font-weight": 700, fill: "#575e75", "font-family": FONT }, `Mudanças desde ${baseline.label}`)
    );
    y += 26;
    const legend = svgEl("g", { transform: `translate(${PAD},${y})` });
    legend.append(
      svgEl("rect", { x: 1.5, y: 1.5, width: 18, height: 12, rx: 3, fill: "none", stroke: colors.added, "stroke-width": 3 }),
      svgEl("text", { x: 28, y: 12, "font-size": 12, fill: "#575e75", "font-family": FONT }, "Adicionado")
    );
    if (!opts.onlyAdded) {
      legend.append(
        svgEl("rect", { x: 131.5, y: 1.5, width: 18, height: 12, rx: 3, fill: "none", stroke: colors.modified, "stroke-width": 3, "stroke-dasharray": "5 3" }),
        svgEl("text", { x: 158, y: 12, "font-size": 12, fill: "#575e75", "font-family": FONT }, "Modificado")
      );
    }
    body.append(legend);
    y += 28;

    for (const section of sections) {
      body.append(svgEl("text", { x: PAD, y: y + 14, "font-size": 13, "font-weight": 700, fill: "#575e75", "font-family": FONT }, section.title));
      y += 26;
      for (const { clone, bbox } of section.scripts) {
        clone.setAttribute("transform", `translate(${PAD - bbox.x},${y - bbox.y})`);
        body.append(clone);
        y += bbox.height + GAP;
        maxWidth = Math.max(maxWidth, bbox.width + PAD * 2);
      }
    }
    const width = Math.ceil(maxWidth);
    const height = Math.ceil(y + PAD - GAP);
    if (opts.background) root.append(svgEl("rect", { x: 0, y: 0, width, height, fill: "#fff" }));
    root.append(body);
    root.setAttribute("width", width);
    root.setAttribute("height", height);
    root.setAttribute("viewBox", `0 0 ${width} ${height}`);
    return root;
  }

  async function buildChangesSvg(opts) {
    const ws0 = getWorkspace();
    if (!ws0) throw new Error("Não encontrei a área de código. Abra a aba de código e tente de novo.");
    if (!diff) return null;
    const original = vm.editingTarget;
    const entries = diff.targets.filter(
      (e) => !e.removedTarget && (e.added.length || (!opts.onlyAdded && e.modified.length))
    );
    const picked = opts.scope === "current" ? entries.filter(isCurrentEntry) : entries;
    if (!picked.length) return null;

    const sections = [];
    try {
      for (const entry of picked) {
        if (!isCurrentEntry(entry)) {
          const t = targetFor(entry);
          if (!t) continue;
          await switchTarget(t.id);
        }
        applyHighlights(true); // garante as classes nos blocos mesmo com o destaque desligado
        const ws = getWorkspace();
        if (ws) sections.push(collectSection(ws, entry, opts.onlyAdded));
      }
    } finally {
      if (original && vm.editingTarget !== original) await switchTarget(original.id);
      applyHighlights();
    }
    const withScripts = sections.filter((s) => s.scripts.length);
    if (!withScripts.length) return null;
    const svg = assembleSvg(withScripts, opts);
    prepareSvg(svg);
    return svg;
  }

  const serializeSvg = (svg) => new XMLSerializer().serializeToString(svg);

  function svgToPngBlob(svg, scale) {
    const width = Number(svg.getAttribute("width"));
    const height = Number(svg.getAttribute("height"));
    const factor = Math.min(scale, 16000 / Math.max(width, height));
    const copy = svg.cloneNode(true);
    copy.setAttribute("width", width * factor);
    copy.setAttribute("height", height * factor);
    const url = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(serializeSvg(copy))));
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * factor);
        canvas.height = Math.round(height * factor);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG vazio"))), "image/png");
      };
      img.onerror = () => reject(new Error("não foi possível converter o SVG em PNG"));
      img.src = url;
    });
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = el("a", { href: url, download: name });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function fileName(ext) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const label = String((baseline && baseline.label) || "commit").replace(/[^\w.-]+/g, "_");
    return `mudancas_${label}_${stamp}.${ext}`;
  }

  // ---------- janela "Imagem das mudanças" ----------
  const modalState = { scope: "current", onlyAdded: false, background: true, svg: null, busy: false, error: "", token: 0 };
  let modalEl = null;
  let modalRefs = null;

  function updateModal() {
    if (!modalEl) return;
    const { preview, status, svgBtn, pngBtn, copyBtn } = modalRefs;
    preview.textContent = "";
    if (modalState.svg) {
      preview.append(
        el("img", {
          alt: "Pré-visualização dos scripts com mudanças",
          src: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(serializeSvg(modalState.svg)),
        })
      );
    }
    status.textContent = modalState.busy
      ? modalState.scope === "all"
        ? "Gerando… o editor alterna entre os sprites por um instante."
        : "Gerando…"
      : modalState.error;
    const ready = !!modalState.svg && !modalState.busy;
    svgBtn.disabled = pngBtn.disabled = copyBtn.disabled = !ready;
  }

  async function refreshImage() {
    const mine = ++modalState.token;
    modalState.busy = true;
    modalState.error = "";
    updateModal();
    try {
      const svg = await buildChangesSvg(modalState);
      if (mine !== modalState.token) return;
      modalState.svg = svg;
      if (!svg) modalState.error = "Não há blocos adicionados" + (modalState.onlyAdded ? "" : " ou modificados") + " para gerar a imagem.";
    } catch (e) {
      console.error(e);
      if (mine !== modalState.token) return;
      modalState.svg = null;
      modalState.error = `Não foi possível gerar a imagem: ${e.message || e}`;
    }
    modalState.busy = false;
    updateModal();
  }

  function closeModal() {
    if (!modalEl) return;
    modalState.token++;
    modalEl.remove();
    modalEl = null;
    modalRefs = null;
  }

  function openModal() {
    if (modalEl || addon.self.disabled || !diff) return;
    const scope = el(
      "select",
      {
        id: "sa-git-scope",
        class: "sa-git-input",
        onChange: (e) => {
          modalState.scope = e.target.value;
          refreshImage();
        },
      },
      el("option", { value: "current" }, "Sprite atual"),
      el("option", { value: "all" }, "Todos os sprites com mudanças")
    );
    scope.value = modalState.scope;
    const onlyAdded = el("input", {
      type: "checkbox",
      id: "sa-git-only-added",
      onChange: (e) => {
        modalState.onlyAdded = e.target.checked;
        refreshImage();
      },
    });
    onlyAdded.checked = modalState.onlyAdded;
    const background = el("input", {
      type: "checkbox",
      id: "sa-git-background",
      onChange: (e) => {
        modalState.background = e.target.checked;
        refreshImage();
      },
    });
    background.checked = modalState.background;

    const preview = el("div", { class: "sa-git-preview" });
    const status = el("div", { class: "sa-git-muted", role: "status", "aria-live": "polite" });
    const svgBtn = button("Baixar SVG", () => {
      if (modalState.svg) downloadBlob(new Blob([serializeSvg(modalState.svg)], { type: "image/svg+xml" }), fileName("svg"));
    });
    const pngBtn = button("Baixar PNG", async () => {
      try {
        downloadBlob(await svgToPngBlob(modalState.svg, 2), fileName("png"));
      } catch (e) {
        modalState.error = `Não foi possível gerar o PNG: ${e.message || e}`;
        updateModal();
      }
    });
    const copyBtn = button("Copiar SVG", async () => {
      try {
        await navigator.clipboard.writeText(serializeSvg(modalState.svg));
        status.textContent = "SVG copiado.";
      } catch (e) {
        status.textContent = "O navegador não deixou copiar. Use Baixar SVG.";
      }
    });
    const closeBtn = button("Fechar", closeModal);

    const dialog = el(
      "div",
      { class: "sa-git-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "sa-git-dialog-title" },
      el("h2", { class: "sa-git-dialog-title", id: "sa-git-dialog-title" }, "Imagem das mudanças"),
      el("div", { class: "sa-git-muted" }, `Scripts com blocos adicionados (contorno sólido) e modificados (tracejado) desde ${baseline.label}.`),
      el(
        "div",
        { class: "sa-git-controls" },
        el("label", { class: "sa-git-check", for: "sa-git-scope" }, "Mostrar:", scope),
        el("label", { class: "sa-git-check", for: "sa-git-only-added" }, onlyAdded, "Somente adicionados"),
        el("label", { class: "sa-git-check", for: "sa-git-background" }, background, "Fundo branco")
      ),
      preview,
      status,
      el("div", { class: "sa-git-footer" }, copyBtn, svgBtn, pngBtn, closeBtn)
    );
    modalEl = el(
      "div",
      {
        class: "sa-git-overlay",
        onClick: (e) => {
          if (e.target === modalEl) closeModal();
        },
        onKeydown: (e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            closeModal();
          }
        },
      },
      dialog
    );
    modalRefs = { preview, status, svgBtn, pngBtn, copyBtn };
    document.body.append(modalEl);
    closeBtn.focus();
    refreshImage();
  }

  // ---------- menus de contexto ----------
  function insertItems(items, newItems) {
    const first = items.findIndex((obj) => obj._isDevtoolsFirstItem);
    items.splice(first !== -1 ? first : items.length, 0, ...newItems);
  }

  addon.tab.createBlockContextMenu(
    (items) => {
      if (addon.self.disabled || !diff) return items;
      const t = diff.totals;
      insertItems(items, [
        {
          enabled: t.added + t.modified > 0,
          text: "Gerar imagem das mudanças (Git)…",
          callback: () => {
            openModal();
          },
          separator: true,
        },
        {
          enabled: true,
          text: showHighlight ? "Ocultar destaque das mudanças (Git)" : "Mostrar destaque das mudanças (Git)",
          callback: toggleHighlight,
          separator: false,
        },
      ]);
      return items;
    },
    { workspace: true }
  );

  addon.tab.createBlockContextMenu(
    (items, block) => {
      if (addon.self.disabled || !diff || !block) return items;
      const td = currentTargetDiff();
      if (!td) return items;
      const kind = td.added.includes(block.id) ? "added" : td.modified.some((m) => m.id === block.id) ? "modified" : null;
      if (!kind) return items;
      insertItems(items, [
        {
          enabled: true,
          text: kind === "added" ? "Git: bloco adicionado — ver na lista" : "Git: bloco modificado — ver o que mudou",
          callback: () => {
            ui.expanded = true;
            renderPanel();
            const row = panel.querySelector(`[data-id="${CSS.escape(block.id)}"]`);
            if (row) row.scrollIntoView({ block: "nearest" });
          },
          separator: true,
        },
      ]);
      return items;
    },
    { blocks: true }
  );

  // ---------- ligações com o editor e com a aba Git ----------
  window.addEventListener("git-tab:baseline", (e) => {
    baseline = e.detail || null;
    navIndex = -1;
    recompute();
  });
  vm.on("workspaceUpdate", () =>
    setTimeout(() => {
      navIndex = -1;
      applyHighlights();
      renderPanel();
    }, 80)
  );
  vm.runtime.on("PROJECT_CHANGED", () => scheduleRecompute());
  vm.runtime.on("PROJECT_LOADED", () => scheduleRecompute(300));
  addon.self.addEventListener("disabled", () => {
    closeModal();
    recompute();
  });
  addon.self.addEventListener("reenabled", () => recompute());
  addon.settings.addEventListener("change", () => {
    showHighlight = getSetting("highlight", true);
    updateStyle();
    applyHighlights();
    renderPanel();
  });
  // o editor recria a área de código ao trocar de aba: religa o painel quando ela voltar
  setInterval(ensureMounted, 1000);
  ensureMounted();
  recompute();
}

// ======================================================================
// Comparação de projetos (código puro, sem DOM): usado pelo destaque de mudanças e pela imagem.
// Compara o project.json do último commit (baseline) com o do projeto aberto, bloco a bloco, pelo id.
// Mudanças de posição (x, y) e de encaixe (next/parent) NÃO contam: só o conteúdo do bloco.
// ======================================================================

const PRIM_OPCODES = { 12: "data_variable", 13: "data_listcontents" };

const isShadow = (b) => !Array.isArray(b) && !!b.shadow;
const primSig = (x) => (Array.isArray(x) ? JSON.stringify(x) : null);

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + stable(value[k]))
      .join(",")}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

// Assinatura de uma entrada (input): só o valor digitado no encaixe e variáveis soltas dentro dele.
// Soltar um bloco num encaixe NÃO muda a assinatura do pai (o bloco novo aparece como "adicionado").
function inputSig(input) {
  if (!Array.isArray(input)) return "";
  const [type, first, second] = input;
  const shadow = type === 1 ? primSig(first) : type === 3 ? primSig(second) : null;
  const inline = type === 2 || type === 3 ? primSig(first) : null;
  return `${shadow}|${inline}`;
}

function blockSig(b) {
  if (Array.isArray(b)) return stable(b);
  const inputs = {};
  for (const k of Object.keys(b.inputs || {})) inputs[k] = inputSig(b.inputs[k]);
  return stable([b.opcode, b.fields || {}, inputs, b.mutation || null]);
}

const fieldValue = (f) => (Array.isArray(f) ? String(f[0]) : String(f));

function inputValue(input) {
  if (!Array.isArray(input)) return "";
  const [type, first, second] = input;
  const shadow = type === 1 ? first : type === 3 ? second : null;
  if (Array.isArray(shadow)) return String(shadow[1]);
  if ((type === 2 || type === 3) && Array.isArray(first)) return String(first[1]);
  return "";
}

function labelFor(b) {
  if (Array.isArray(b)) return PRIM_OPCODES[b[0]] === "data_variable" ? `variável "${b[1]}"` : `lista "${b[1]}"`;
  const parts = [];
  for (const f of Object.values(b.fields || {})) parts.push(fieldValue(f));
  for (const i of Object.values(b.inputs || {})) {
    const v = inputValue(i);
    if (v !== "") parts.push(v);
  }
  const name = String(b.opcode || "bloco").replace(/_/g, " ");
  const text = parts.length ? `${name}: ${parts.join(", ")}` : name;
  return text.length > 70 ? text.slice(0, 67) + "…" : text;
}

function describeChange(before, after) {
  if (Array.isArray(before) || Array.isArray(after)) return ["valor alterado"];
  const lines = [];
  if (before.opcode !== after.opcode) lines.push(`bloco: ${before.opcode} → ${after.opcode}`);

  const fieldKeys = new Set([...Object.keys(before.fields || {}), ...Object.keys(after.fields || {})]);
  for (const k of fieldKeys) {
    const a = (before.fields || {})[k];
    const b = (after.fields || {})[k];
    if (stable(a) !== stable(b)) lines.push(`${k}: ${a ? fieldValue(a) : "—"} → ${b ? fieldValue(b) : "—"}`);
  }

  const inputKeys = new Set([...Object.keys(before.inputs || {}), ...Object.keys(after.inputs || {})]);
  for (const k of inputKeys) {
    const a = (before.inputs || {})[k];
    const b = (after.inputs || {})[k];
    if (inputSig(a) !== inputSig(b)) lines.push(`${k}: ${inputValue(a) || "—"} → ${inputValue(b) || "—"}`);
  }

  if (stable(before.mutation || null) !== stable(after.mutation || null)) lines.push("mutação alterada");
  return lines;
}

function diffBlocks(baseBlocks, curBlocks) {
  baseBlocks = baseBlocks || {};
  curBlocks = curBlocks || {};
  const added = [];
  const removed = [];
  const modified = new Map();
  const mark = (id, lines) => {
    const list = modified.get(id) || [];
    for (const line of lines) if (!list.includes(line)) list.push(line);
    modified.set(id, list);
  };

  for (const id of Object.keys(curBlocks)) {
    const cur = curBlocks[id];
    const base = baseBlocks[id];
    if (!base) {
      if (!isShadow(cur)) added.push(id);
      continue;
    }
    if (blockSig(base) === blockSig(cur)) continue;
    const lines = describeChange(base, cur);
    if (isShadow(cur)) {
      // menu (dropdown) alterado: quem o usuário vê mudar é o bloco que contém o menu
      const parent = cur.parent;
      if (parent && baseBlocks[parent] && curBlocks[parent] && !isShadow(curBlocks[parent])) {
        mark(
          parent,
          lines.map((l) => `menu ${l}`)
        );
      }
    } else {
      mark(id, lines);
    }
  }

  for (const id of Object.keys(baseBlocks)) {
    if (!(id in curBlocks) && !isShadow(baseBlocks[id])) removed.push({ id, label: labelFor(baseBlocks[id]) });
  }

  return {
    added,
    modified: Array.from(modified, ([id, lines]) => ({ id, lines })),
    removed,
  };
}

function diffProjects(baseline, current) {
  const key = (t) => (t.isStage ? "\u0000stage" : t.name);
  const baseMap = new Map((baseline.targets || []).map((t) => [key(t), t]));
  const targets = [];

  for (const cur of current.targets || []) {
    const base = baseMap.get(key(cur));
    baseMap.delete(key(cur));
    targets.push({
      name: cur.isStage ? "Stage" : cur.name,
      isStage: !!cur.isStage,
      newTarget: !base,
      ...diffBlocks(base ? base.blocks : {}, cur.blocks),
    });
  }
  for (const base of baseMap.values()) {
    targets.push({
      name: base.isStage ? "Stage" : base.name,
      isStage: !!base.isStage,
      removedTarget: true,
      added: [],
      modified: [],
      removed: diffBlocks(base.blocks, {}).removed,
    });
  }

  const totals = { added: 0, modified: 0, removed: 0 };
  for (const t of targets) {
    totals.added += t.added.length;
    totals.modified += t.modified.length;
    totals.removed += t.removed.length;
  }
  return { targets, totals };
}

function summaryText(diff) {
  const { added, modified, removed } = diff.totals;
  if (!added && !modified && !removed) return "Sem mudanças nos blocos";
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const parts = [];
  if (added) parts.push(plural(added, "bloco adicionado", "blocos adicionados"));
  if (modified) parts.push(plural(modified, "bloco modificado", "blocos modificados"));
  if (removed) parts.push(plural(removed, "bloco removido", "blocos removidos"));
  const lines = [`Blocos: ${parts.join(", ")}`];
  for (const t of diff.targets) {
    const c = [];
    if (t.added.length) c.push(`+${t.added.length}`);
    if (t.modified.length) c.push(`~${t.modified.length}`);
    if (t.removed.length) c.push(`−${t.removed.length}`);
    if (c.length) lines.push(`- ${t.isStage ? "Palco" : t.name}: ${c.join(" ")}`);
  }
  return lines.join("\n");
}