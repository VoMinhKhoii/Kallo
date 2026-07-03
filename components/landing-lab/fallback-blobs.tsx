/**
 * The lab's no-WebGL / still-loading ground: two soft clay-tone glows on
 * cream. Deliberately a leaf module so lazy three.js chunks can show it
 * without pulling any GL code along.
 */
export function FallbackBlobs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      <div className="absolute top-[-10%] right-[-5%] h-[600px] w-[600px] rounded-full bg-[#E8D5B5]/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-[#C9A87C]/10 blur-[100px]" />
    </div>
  );
}
