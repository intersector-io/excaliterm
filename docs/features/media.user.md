# Screenshots & Screen Share

You can capture a **screenshot** of a host's monitor or stream a **live screen share** directly onto the canvas.

## Taking a screenshot

1. On a terminal node (or its mobile back-face) open the overflow menu and choose **Take Screenshot**.
2. The **Monitor Picker** dialog lists every display attached to the host with its dimensions.
3. Select a monitor and click **Capture**.
4. A screenshot node appears on the canvas (connected to the source terminal). It shows the image, the host, the monitor index, and the capture time.
5. Click the fullscreen icon to expand the image; use the × button to delete the node.

## Streaming a screen

1. From the same menu choose **Stream Screen**.
2. Pick the monitor in the Monitor Picker.
3. A screen-share node appears with a live preview (default ~3 fps).
4. Status indicator:
   - **Live** — green pulse
   - **Buffering** — amber pulse
   - **Paused** — amber static
5. Controls on the node:
   - **Play / Pause** — temporarily freezes rendering without stopping the underlying stream.
   - **Fullscreen** — opens the preview full-size (ESC to exit).
   - **Stop** — ends the stream on the host.

Multiple collaborators can view the same stream simultaneously — frames are broadcast to the whole workspace.

## Mobile media viewer

On mobile, screenshots and live streams show up in the **Media** section of the list view. Tap a thumbnail to open it fullscreen, use the arrows to cycle through media, and tap the back button or ESC to close.
