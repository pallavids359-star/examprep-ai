import { lecturersFor, subjectName, subjectOfSection } from "./liveHelpers";

// <option>s for a subject's lecturer dropdown: that subject's lecturers first, the rest below
export default function LecturerOptions({ list, sectionKey, showEmail = false }) {
  const { match, other } = lecturersFor(list, sectionKey);
  const label = (l) => `${l.name}${showEmail ? ` · ${l.email}` : ""}`;
  return (
    <>
      <option value="">Choose a {subjectName(subjectOfSection(sectionKey))} lecturer...</option>
      {match.length > 0 && (
        <optgroup label={`${subjectName(subjectOfSection(sectionKey))} lecturers`}>
          {match.map((l) => (
            <option key={l._id} value={l._id}>
              {label(l)}
            </option>
          ))}
        </optgroup>
      )}
      {other.length > 0 && (
        <optgroup label="Other lecturers">
          {other.map((l) => (
            <option key={l._id} value={l._id}>
              {label(l)} ({subjectName(l.subject)})
            </option>
          ))}
        </optgroup>
      )}
    </>
  );
}
