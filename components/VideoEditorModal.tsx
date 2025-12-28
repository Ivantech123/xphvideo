import React, { useState, useEffect } from 'react';
import { Video } from '../types';
import { Icon } from './Icon';

interface VideoEditorModalProps {
  video?: Video | null;
  onSave: (video: Video) => void;
  onClose: () => void;
}

export const VideoEditorModal: React.FC<VideoEditorModalProps> = ({ video, onSave, onClose }) => {
  const [formData, setFormData] = useState<Partial<Video>>({
    title: '',
    thumbnail: '',
    embedUrl: '',
    duration: 0,
    tags: [],
    source: 'Local',
    views: 0,
    rating: 0
  });

  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (video) {
      setFormData({ ...video });
    }
  }, [video]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (tagInput.trim()) {
      const newTag = { id: `tag_${Date.now()}`, label: tagInput.trim() };
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), newTag]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagId: string) => {
    setFormData(prev => ({
      ...prev,
      tags: (prev.tags || []).filter(t => t.id !== tagId)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate
    if (!formData.title || !formData.embedUrl) {
      alert('Title and Embed URL are required');
      return;
    }

    const savedVideo: Video = {
      id: formData.id || `manual_${Date.now()}`,
      title: formData.title || 'Untitled',
      description: formData.description || '',
      thumbnail: formData.thumbnail || 'https://via.placeholder.com/320x180',
      embedUrl: formData.embedUrl,
      videoUrl: formData.videoUrl || '',
      duration: Number(formData.duration) || 0,
      views: Number(formData.views) || 0,
      rating: Number(formData.rating) || 0,
      source: (formData.source as any) || 'Local',
      quality: 'HD',
      tags: formData.tags || [],
      creator: formData.creator || {
        id: 'admin_user',
        name: 'Admin',
        avatar: '',
        verified: true,
        tier: 'Premium'
      }
    };

    onSave(savedVideo);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-brand-surface border border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Icon name={video ? "Edit" : "Plus"} className="text-brand-gold" />
            {video ? 'Edit Video' : 'Add New Video'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <Icon name="X" size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
              <input 
                type="text" 
                name="title"
                value={formData.title} 
                onChange={handleChange}
                className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-brand-gold outline-none"
                placeholder="Video Title"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Source</label>
              <select 
                name="source"
                value={formData.source} 
                onChange={handleChange}
                className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-brand-gold outline-none"
              >
                <option value="Local">Local / Manual</option>
                <option value="Pornhub">Pornhub</option>
                <option value="Eporner">Eporner</option>
                <option value="XVideos">XVideos</option>
              </select>
            </div>
          </div>

          <div>
             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Embed URL / Iframe Src</label>
             <input 
               type="text" 
               name="embedUrl"
               value={formData.embedUrl} 
               onChange={handleChange}
               className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-brand-gold outline-none font-mono text-sm"
               placeholder="https://..."
             />
          </div>

          <div>
             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Thumbnail URL</label>
             <input 
               type="text" 
               name="thumbnail"
               value={formData.thumbnail} 
               onChange={handleChange}
               className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-brand-gold outline-none font-mono text-sm"
               placeholder="https://..."
             />
          </div>

          <div className="grid grid-cols-3 gap-4">
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Duration (sec)</label>
                <input 
                  type="number" 
                  name="duration"
                  value={formData.duration} 
                  onChange={handleChange}
                  className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-brand-gold outline-none"
                />
             </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Views</label>
                <input 
                  type="number" 
                  name="views"
                  value={formData.views} 
                  onChange={handleChange}
                  className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-brand-gold outline-none"
                />
             </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rating (%)</label>
                <input 
                  type="number" 
                  name="rating"
                  value={formData.rating} 
                  onChange={handleChange}
                  className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-brand-gold outline-none"
                />
             </div>
          </div>

          <div>
             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tags</label>
             <div className="flex flex-wrap gap-2 mb-2 p-2 bg-black/20 rounded min-h-[40px]">
                {formData.tags?.map(tag => (
                   <span key={tag.id} className="bg-brand-gold text-black text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                      {tag.label}
                      <button type="button" onClick={() => removeTag(tag.id)} className="hover:text-white"><Icon name="X" size={12} /></button>
                   </span>
                ))}
             </div>
             <div className="flex gap-2">
                <input 
                  type="text" 
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="flex-1 bg-black/40 border border-white/10 rounded p-2 text-white focus:border-brand-gold outline-none"
                  placeholder="Add tag..."
                />
                <button onClick={handleAddTag} className="bg-brand-surface border border-white/10 px-4 rounded hover:border-brand-gold">Add</button>
             </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
             <button type="button" onClick={onClose} className="px-6 py-2 rounded-lg border border-white/10 hover:bg-white/10 transition">Cancel</button>
             <button type="submit" className="px-6 py-2 rounded-lg bg-brand-gold text-black font-bold hover:bg-yellow-500 transition">Save Video</button>
          </div>
        </form>
      </div>
    </div>
  );
};
